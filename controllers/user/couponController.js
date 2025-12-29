const Coupon = require('../../models/couponSchema');
const Order = require('../../models/orderSchema');
const STATUS = require('../../constants/statusCode');
const MESSAGES = require('../../constants/messages'); // Centralized messages

exports.applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartTotal } = req.body;
        const userId = req.user?._id;

        if (!userId) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login to apply coupon'
            });
        }

        if (!couponCode || !cartTotal || cartTotal < 0) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.VALIDATION.INVALID_INPUT || 'Valid coupon code and cart total required'
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
                message: MESSAGES.COUPON.INVALID || 'Invalid coupon code'
            });
        }

        const now = new Date();
        const startDate = new Date(coupon.startDate);
        const expireDate = new Date(coupon.expireOn);
        const expireEndOfDay = new Date(expireDate.setHours(23, 59, 59, 999));

        if (now < startDate) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.COUPON.NOT_ACTIVE_YET || `Coupon not active yet. Valid from ${startDate.toLocaleDateString()}`
            });
        }

        if (now > expireEndOfDay) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.COUPON.EXPIRED || 'Coupon has expired'
            });
        }

        if (cartTotal < coupon.minimumPrice) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.COUPON.MINIMUM_NOT_MET || `Minimum order of ₹${coupon.minimumPrice} required`
            });
        }

        const userUsed = await Order.findOne({
            user: userId,
            couponCode: coupon.couponCode,
            status: { $nin: ['cancelled', 'payment_failed'] }
        });

        if (userUsed) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.COUPON.ALREADY_USED || 'You have already used this coupon'
            });
        }

        const totalUsed = await Order.countDocuments({
            couponCode: coupon.couponCode,
            status: { $nin: ['cancelled', 'payment_failed'] }
        });

        if (totalUsed >= coupon.usageLimit) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.COUPON.LIMIT_EXCEEDED || 'Coupon usage limit reached'
            });
        }

        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (cartTotal * coupon.offerPrice) / 100;
        } else {
            discountAmount = coupon.offerPrice;
        }

        discountAmount = Math.min(discountAmount, cartTotal);

        res.json({
            success: true,
            message: MESSAGES.COUPON.APPLIED_SUCCESS || 'Coupon applied successfully',
            coupon: {
                code: coupon.couponCode,
                name: coupon.name,
                discountAmount: Math.round(discountAmount),
                discountType: coupon.discountType,
                offerPrice: coupon.offerPrice
            }
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
        });
    }
};

exports.getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.user?._id;
        let cartTotal = parseFloat(req.query.cartTotal) || 0;
        if (cartTotal < 0) cartTotal = 0;

        if (!userId) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login'
            });
        }

        const now = new Date();

        const coupons = await Coupon.find({
            isListed: true,
            startDate: { $lte: now },
            expireOn: { $gte: now }
        }).sort({ createdOn: -1 });

        const usedCouponCodes = new Set(
            await Order.find({
                user: userId,
                couponCode: { $exists: true, $ne: null },
                status: { $nin: ['cancelled', 'payment_failed'] }
            }).distinct('couponCode')
        );

        const usageStats = await Order.aggregate([
            {
                $match: {
                    couponCode: { $in: coupons.map(c => c.couponCode) },
                    status: { $nin: ['cancelled', 'payment_failed'] }
                }
            },
            { $group: { _id: '$couponCode', count: { $sum: 1 } } }
        ]);

        const usageMap = {};
        usageStats.forEach(stat => usageMap[stat._id] = stat.count);

        const availableCoupons = coupons.map(coupon => {
            const totalUsed = usageMap[coupon.couponCode] || 0;
            const alreadyUsed = usedCouponCodes.has(coupon.couponCode);
            const limitReached = totalUsed >= coupon.usageLimit;
            const minNotMet = cartTotal < coupon.minimumPrice;

            const isUsable = !alreadyUsed && !limitReached && !minNotMet;

            let discountAmount = 0;
            let reason = null;

            if (alreadyUsed) reason = MESSAGES.COUPON.REASON_ALREADY_USED || 'Already used';
            else if (limitReached) reason = MESSAGES.COUPON.REASON_LIMIT_REACHED || 'Usage limit reached';
            else if (minNotMet) reason = MESSAGES.COUPON.REASON_MINIMUM || `Minimum ₹${coupon.minimumPrice} required`;

            if (isUsable) {
                if (coupon.discountType === 'percentage') {
                    discountAmount = (cartTotal * coupon.offerPrice) / 100;
                } else {
                    discountAmount = coupon.offerPrice;
                }
                discountAmount = Math.min(discountAmount, cartTotal);
            }

            return {
                ...coupon.toObject(),
                isUsable,
                discountAmount: Math.floor(discountAmount),
                reason
            };
        });

        res.json({ success: true, coupons: availableCoupons });

    } catch (error) {
        console.error('Error fetching available coupons:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
        });
    }
};

exports.getCouponsPage = async (req, res) => {
    try {
        const userId = req.user?._id;
        const now = new Date();

        const coupons = await Coupon.find({
            isListed: true,
            startDate: { $lte: now },
            expireOn: { $gte: now }
        }).sort({ createdOn: -1 });

        let usedCouponCodes = [];
        if (userId) {
            usedCouponCodes = await Order.find({
                user: userId,
                couponCode: { $exists: true, $ne: null },
                status: { $nin: ['cancelled', 'payment_failed'] }
            }).distinct('couponCode');
        }

        const usageStats = await Order.aggregate([
            {
                $match: {
                    couponCode: { $in: coupons.map(c => c.couponCode) },
                    status: { $nin: ['cancelled', 'payment_failed'] }
                }
            },
            { $group: { _id: '$couponCode', usedCount: { $sum: 1 } } }
        ]);

        const usageMap = {};
        usageStats.forEach(s => usageMap[s._id] = s.usedCount);

        const couponData = coupons.map(coupon => ({
            ...coupon.toObject(),
            isUsed: usedCouponCodes.includes(coupon.couponCode),
            isAvailable: (usageMap[coupon.couponCode] || 0) < coupon.usageLimit,
            usedCount: usageMap[coupon.couponCode] || 0
        }));

        res.render('user/coupons', {
            coupons: couponData,
            user: req.user
        });

    } catch (error) {
        console.error('Error loading coupons page:', error);
        res.status(STATUS.INTERNAL_ERROR).render('user/page-404', {
            message: MESSAGES.COUPON.LOAD_FAILED || 'An error occurred while loading coupons.',
            pageTitle: 'Error'
        });
    }
};