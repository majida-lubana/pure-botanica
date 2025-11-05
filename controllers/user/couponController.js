const Coupon = require('../../models/couponSchema');
const Order = require('../../models/orderSchema');

// Apply coupon in checkout
exports.applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartTotal } = req.body;
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login to apply coupon' });
        }

        if (!couponCode || !cartTotal) {
            return res.status(400).json({ success: false, message: 'Coupon code and cart total are required' });
        }

        // Find coupon
        const coupon = await Coupon.findOne({ 
            couponCode: couponCode.toUpperCase(),
            isListed: true 
        });

        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Invalid coupon code' });
        }

        // Check date validity
        const currentDate = new Date();
        const startDate = new Date(coupon.startDate);
        const expireDate = new Date(coupon.expireOn);

        if (currentDate < startDate) {
            return res.status(400).json({ 
                success: false, 
                message: `Coupon is not yet active. Valid from ${startDate.toLocaleDateString()}` 
            });
        }

        if (currentDate > expireDate) {
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }

        // Check minimum order value
        if (cartTotal < coupon.minimumPrice) {
            return res.status(400).json({ 
                success: false, 
                message: `Minimum order value of ₹${coupon.minimumPrice} required` 
            });
        }

        // Check if user has already used this coupon
        const userUsedCoupon = await Order.findOne({
            user: userId,
            couponCode: coupon.couponCode,
            status: { $nin: ['cancelled', 'payment_failed'] }
        });

        if (userUsedCoupon) {
            return res.status(400).json({ success: false, message: 'You have already used this coupon' });
        }

        // Check usage limit
        const totalUsed = await Order.countDocuments({
            couponCode: coupon.couponCode,
            status: { $nin: ['cancelled', 'payment_failed'] }
        });

        if (totalUsed >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit exceeded' });
        }

        // Calculate discount
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (cartTotal * coupon.offerPrice) / 100;
        } else {
            discountAmount = coupon.offerPrice;
        }

        // Ensure discount doesn't exceed cart total
        discountAmount = Math.min(discountAmount, cartTotal);

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            coupon: {
                code: coupon.couponCode,
                name: coupon.name,
                discountAmount: discountAmount,
                discountType: coupon.discountType,
                offerPrice: coupon.offerPrice
            }
        });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get available coupons for user
exports.getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.user?._id;
        const cartTotal = parseFloat(req.query.cartTotal) || 0;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Please login' });
        }

        const currentDate = new Date();
        
        // Get all active coupons
        const coupons = await Coupon.find({
            isListed: true,
            startDate: { $lte: currentDate },
            expireOn: { $gte: currentDate }
        }).sort({ createdOn: -1 });

        // Get user's used coupons
        const usedCoupons = await Order.find({
            user: userId,
            couponCode: { $exists: true, $ne: null },
            status: { $nin: ['cancelled', 'payment_failed'] }
        }).distinct('couponCode');

        // Filter and prepare coupons
        const availableCoupons = [];
        
        for (const coupon of coupons) {
            const totalUsed = await Order.countDocuments({
                couponCode: coupon.couponCode,
                status: { $nin: ['cancelled', 'payment_failed'] }
            });

            const isUsable = !usedCoupons.includes(coupon.couponCode) && 
                           totalUsed < coupon.usageLimit &&
                           cartTotal >= coupon.minimumPrice;

            let discountAmount = 0;
            if (coupon.discountType === 'percentage') {
                discountAmount = Math.min((cartTotal * coupon.offerPrice) / 100, cartTotal);
            } else {
                discountAmount = Math.min(coupon.offerPrice, cartTotal);
            }

            availableCoupons.push({
                ...coupon.toObject(),
                isUsable,
                discountAmount: Math.floor(discountAmount),
                reason: !isUsable ? (
                    usedCoupons.includes(coupon.couponCode) ? 'Already used' :
                    totalUsed >= coupon.usageLimit ? 'Usage limit reached' :
                    cartTotal < coupon.minimumPrice ? `Minimum ₹${coupon.minimumPrice} required` : ''
                ) : null
            });
        }

        res.json({ success: true, coupons: availableCoupons });
    } catch (error) {
        console.error('Error getting available coupons:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get coupons page for user
exports.getCouponsPage = async (req, res) => {
    try {
        const userId = req.user?._id;
        const currentDate = new Date();
        
        // Get all active coupons
        const coupons = await Coupon.find({
            isListed: true,
            startDate: { $lte: currentDate },
            expireOn: { $gte: currentDate }
        }).sort({ createdOn: -1 });

        // Get user's used coupons
        const usedCoupons = userId ? await Order.find({
            user: userId,
            couponCode: { $exists: true, $ne: null },
            status: { $nin: ['cancelled', 'payment_failed'] }
        }).distinct('couponCode') : [];

        // Prepare coupons with usage info
        const couponData = [];
        
        for (const coupon of coupons) {
            const totalUsed = await Order.countDocuments({
                couponCode: coupon.couponCode,
                status: { $nin: ['cancelled', 'payment_failed'] }
            });

            const isUsed = usedCoupons.includes(coupon.couponCode);
            const isAvailable = totalUsed < coupon.usageLimit;

            couponData.push({
                ...coupon.toObject(),
                isUsed,
                isAvailable,
                usedCount: totalUsed
            });
        }

        res.render('user/coupons', {
            coupons: couponData,
            user: req.user
        });
    } catch (error) {
        console.error('Error loading coupons page:', error);
        res.status(500).send('Internal Server Error');
    }
};