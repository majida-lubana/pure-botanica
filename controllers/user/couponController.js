import Coupon from '../../models/couponSchema.js';
import Order from '../../models/orderSchema.js';
import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js';


export const applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartTotal } = req.body;
        const userId = req.user?._id;

        if (!userId) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login'
            });
        }

        const total = parseFloat(cartTotal);
        if (!couponCode || isNaN(total) || total <= 0) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Valid coupon code and cart total required'
            });
        }

        const code = couponCode.trim().toUpperCase();

        const coupon = await Coupon.findOne({
            couponCode: code,
            isListed: true
        });

        if (!coupon) {
            return res.status(STATUS.NOT_FOUND).json({
                success: false,
                message: 'Invalid coupon code'
            });
        }

        const now = new Date();
        const startDate = new Date(coupon.startDate);
        const expireEndOfDay = new Date(coupon.expireOn);
        expireEndOfDay.setHours(23, 59, 59, 999);

        if (now < startDate) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: `Coupon valid from ${startDate.toLocaleDateString()}`
            });
        }

        if (now > expireEndOfDay) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Coupon expired'
            });
        }

        if (total < coupon.minimumPrice) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: `Minimum order ₹${coupon.minimumPrice} required`
            });
        }

        const alreadyUsed = await Order.findOne({
            user: userId,
            couponCode: coupon.couponCode,
            status: { $nin: ['cancelled', 'payment_failed'] }
        });

        if (alreadyUsed) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: 'You have already used this coupon'
            });
        }

        const totalUsed = await Order.countDocuments({
            couponCode: coupon.couponCode,
            status: { $nin: ['cancelled', 'payment_failed'] }
        });

        if (totalUsed >= coupon.usageLimit) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: 'Coupon usage limit reached'
            });
        }

        let discountAmount = 0;

        if (coupon.discountType === 'percentage') {
            discountAmount = (total * coupon.offerPrice) / 100;
            if (coupon.maxDiscount != null) {
                discountAmount = Math.min(discountAmount, coupon.maxDiscount);
            }
        } else {
            discountAmount = coupon.offerPrice;
        }

        discountAmount = Math.min(discountAmount, total);
        discountAmount = Math.floor(discountAmount);

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            coupon: {
                code: coupon.couponCode,
                name: coupon.name,
                discountAmount,
                discountType: coupon.discountType,
                offerPrice: coupon.offerPrice,
                maxDiscount:
                    coupon.discountType === 'percentage'
                        ? coupon.maxDiscount
                        : null
            }
        });

    } catch (error) {
        console.error('Apply coupon error:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: 'Server error'
        });
    }
};


export const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.user?._id;
        let cartTotal = parseFloat(req.query.cartTotal) || 0;
        if (cartTotal < 0) cartTotal = 0;

        if (!userId) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                message: 'Please login'
            });
        }

        const now = new Date();

        
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const coupons = await Coupon.find({
            isListed: true,
            startDate: { $lte: now },          
            expireOn: { $gte: todayStart }     
        })
            .sort({ createdOn: -1 })
            .lean();

        const usedCouponCodes = new Set(
            await Order.find({
                user: userId,
                couponCode: { $exists: true, $ne: null },
                status: { $nin: ['cancelled', 'payment_failed'] }
            }).distinct('couponCode')
        );

        const couponCodes = coupons.map(c => c.couponCode);

        const usageStats = await Order.aggregate([
            {
                $match: {
                    couponCode: { $in: couponCodes },
                    status: { $nin: ['cancelled', 'payment_failed'] }
                }
            },
            { $group: { _id: '$couponCode', count: { $sum: 1 } } }
        ]);

        const usageMap = new Map();
        usageStats.forEach(u => usageMap.set(u._id, u.count));

        const availableCoupons = coupons.map(coupon => {
            const totalUsed = usageMap.get(coupon.couponCode) || 0;
            const alreadyUsed = usedCouponCodes.has(coupon.couponCode);
            const limitReached = totalUsed >= coupon.usageLimit;
            const minNotMet = cartTotal < coupon.minimumPrice;

            const isUsable = !alreadyUsed && !limitReached && !minNotMet;

            let discountAmount = 0;
            let reason = null;

            if (alreadyUsed) reason = 'Already used';
            else if (limitReached) reason = 'Usage limit reached';
            else if (minNotMet) reason = `Min ₹${coupon.minimumPrice} required`;

            if (isUsable) {
                if (coupon.discountType === 'percentage') {
                    discountAmount = (cartTotal * coupon.offerPrice) / 100;
                    if (coupon.maxDiscount != null) {
                        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
                    }
                } else {
                    discountAmount = coupon.offerPrice;
                }
                discountAmount = Math.min(discountAmount, cartTotal);
                discountAmount = Math.floor(discountAmount);
            }

            return {
                ...coupon,
                isUsable,
                usedCount: totalUsed,
                discountAmount,
                reason,
                maxDiscount: coupon.discountType === 'percentage' ? coupon.maxDiscount : null
            };
        });

        res.json({ success: true, coupons: availableCoupons });

    } catch (error) {
        console.error('Available coupons error:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: 'Server error'
        });
    }
};


export const getCouponsPage = async (req, res) => {
    try {
        const userId = req.user?._id || null;

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const coupons = await Coupon.find({
            isListed: true,
            startDate: { $lte: now },
            expireOn: { $gte: todayStart }
        })
            .sort({ createdOn: -1 })
            .lean();

        let usedCouponCodes = [];
        if (userId) {
            usedCouponCodes = await Order.find({
                user: userId,
                couponCode: { $exists: true, $ne: null },
                status: { $nin: ['cancelled', 'payment_failed'] }
            }).distinct('couponCode');
        }

        const couponCodes = coupons.map(c => c.couponCode);

        const usageStats = await Order.aggregate([
            {
                $match: {
                    couponCode: { $in: couponCodes },
                    status: { $nin: ['cancelled', 'payment_failed'] }
                }
            },
            { $group: { _id: '$couponCode', usedCount: { $sum: 1 } } }
        ]);

        const usageMap = new Map();
        usageStats.forEach(u => usageMap.set(u._id, u.usedCount));

        const couponData = coupons
            .map(coupon => {
                const usedCount = usageMap.get(coupon.couponCode) || 0;
                return {
                    ...coupon,
                    isUsed: usedCouponCodes.includes(coupon.couponCode),
                    isAvailable: usedCount < coupon.usageLimit,
                    usedCount,
                    maxDiscount:
                        coupon.discountType === 'percentage'
                            ? coupon.maxDiscount
                            : null
                };
            })
            .filter(c => c.isAvailable);

        res.render('user/coupons', {
            coupons: couponData,
            user: req.user
        });

    } catch (error) {
        console.error('User coupons page error:', error);
        res.status(STATUS.INTERNAL_ERROR).render('user/page-404', {
            pageTitle: 'Error',
            message: 'Failed to load coupons'
        });
    }
};

export default {
    applyCoupon,
    getAvailableCoupons,
    getCouponsPage
};