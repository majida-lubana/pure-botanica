const Coupon = require('../../models/couponSchema');
const mongoose = require('mongoose');

// Load coupon management page
exports.getCouponPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const search = req.query.search || '';
        const filter = {};
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { couponCode: { $regex: search, $options: 'i' } }
            ];
        }

        const totalCoupons = await Coupon.countDocuments(filter);
        const totalPages = Math.ceil(totalCoupons / limit);

        const coupons = await Coupon.find(filter)
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.render('admin/couponManage', {
            coupons,
            currentPage: page,
            totalPages,
            search,
            admin: req.session.admin
        });

        console.log("Active coupons found:", coupons.map(c => ({
    code: c.couponCode,
    isListed: c.isListed,
    start: c.startDate,
    expire: c.expireOn,
    usageLimit: c.usageLimit
})));
    } catch (error) {
        console.error('Error loading coupon page:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Add new coupon
exports.addCoupon = async (req, res) => {
    try {
        const {
            name,
            couponCode,
            startDate,
            expireOn,
            offerPrice,
            minimumPrice,
            usageLimit,
            description,
            discountType
        } = req.body;

        console.log('addCoupon raw input:', { startDate, expireOn });

        // === VALIDATION ===
        const errors = [];
        
        if (!name || name.trim().length < 3) errors.push('Name too short');
        if (!couponCode || couponCode.trim().length < 4) errors.push('Code too short');

        const startDateObj = new Date(startDate);
        const expireDateObj = new Date(expireOn);

        console.log('Parsed dates:', { startDateObj, expireDateObj });

        if (isNaN(startDateObj)) errors.push('Invalid start date');
        if (isNaN(expireDateObj)) errors.push('Invalid expire date');

        // --- Allow start date = today ---
        const today = new Date();
        today.setHours(0, 0, 0, 0); // local midnight

        if (startDateObj < today) {
            errors.push('Start date cannot be in the past');
        }

        if (expireDateObj <= startDateObj) {
            errors.push('Expire date must be after start date');
        }

        const offer = parseFloat(offerPrice);
        if (isNaN(offer) || offer <= 0) errors.push('Invalid offer price');
        if (discountType === 'percentage' && offer > 100) errors.push('Percentage cannot exceed 100');

        const minPrice = parseFloat(minimumPrice);
        if (isNaN(minPrice) || minPrice < 0) errors.push('Invalid minimum price');

        const limit = parseInt(usageLimit);
        if (isNaN(limit) || limit <= 0) errors.push('Invalid usage limit');

        if (errors.length > 0) {
            console.log('Validation errors:', errors);
            return res.status(400).json({ success: false, message: errors.join(', ') });
        }

        // === CHECK DUPLICATE ===
        const code = couponCode.trim().toUpperCase();
        const existing = await Coupon.findOne({ couponCode: code });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists' });
        }

        // === SAVE ===
        const newCoupon = new Coupon({
            name: name.trim(),
            couponCode: code,
            startDate: startDateObj,
            expireOn: expireDateObj,
            offerPrice: offer,
            minimumPrice: minPrice,
            usageLimit: limit,
            description: description?.trim() || '',
            discountType: discountType || 'fixed',
            isListed: true
        });

        const saved = await newCoupon.save();
        console.log('Coupon saved:', {
            _id: saved._id,
            code: saved.couponCode,
            start: saved.startDate,
            expire: saved.expireOn,
            isListed: saved.isListed
        });

        res.json({ success: true, message: 'Coupon created successfully' });
    } catch (error) {
        console.error('Error adding coupon:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get coupon for editing
exports.getCouponById = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }
        res.json({ success: true, coupon });
    } catch (error) {
        console.error('Error getting coupon:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Update coupon
exports.updateCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const {
            name,
            couponCode,
            startDate,
            expireOn,
            offerPrice,
            minimumPrice,
            usageLimit,
            description,
            discountType
        } = req.body;

        // Validation (same as add)
        const errors = [];
        
        if (!name || name.trim().length < 3) {
            errors.push('Coupon name must be at least 3 characters');
        }
        
        if (!couponCode || couponCode.trim().length < 4) {
            errors.push('Coupon code must be at least 4 characters');
        }
        
        const startDateObj = new Date(startDate);
        const expireDateObj = new Date(expireOn);
        
        if (expireDateObj <= startDateObj) {
            errors.push('Expire date must be after start date');
        }
        
        if (!offerPrice || offerPrice <= 0) {
            errors.push('Offer price must be greater than 0');
        }
        
        if (discountType === 'percentage' && offerPrice > 100) {
            errors.push('Percentage discount cannot exceed 100%');
        }
        
        if (!minimumPrice || minimumPrice < 0) {
            errors.push('Minimum price must be 0 or greater');
        }
        
        if (!usageLimit || usageLimit <= 0) {
            errors.push('Usage limit must be greater than 0');
        }

        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: errors.join(', ') });
        }

        // Check if coupon code already exists (excluding current coupon)
        const existingCoupon = await Coupon.findOne({ 
            couponCode: couponCode.trim().toUpperCase(),
            _id: { $ne: couponId }
        });
        
        if (existingCoupon) {
            return res.status(400).json({ success: false, message: 'Coupon code already exists' });
        }

        await Coupon.findByIdAndUpdate(couponId, {
            name: name.trim(),
            couponCode: couponCode.trim().toUpperCase(),
            startDate: startDateObj,
            expireOn: expireDateObj,
            offerPrice: parseFloat(offerPrice),
            minimumPrice: parseFloat(minimumPrice),
            usageLimit: parseInt(usageLimit),
            description: description?.trim() || '',
            discountType: discountType || 'fixed'
        });

        res.json({ success: true, message: 'Coupon updated successfully' });
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Toggle coupon status
exports.toggleCouponStatus = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        coupon.isListed = !coupon.isListed;
        await coupon.save();

        res.json({ 
            success: true, 
            message: `Coupon ${coupon.isListed ? 'listed' : 'unlisted'} successfully`,
            isListed: coupon.isListed 
        });
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Delete coupon
exports.deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }

        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};