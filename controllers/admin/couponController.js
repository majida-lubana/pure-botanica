

import Coupon from '../../models/couponSchema.js';
import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js';

export const getCouponPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
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
            layout: 'layouts/adminLayout',
            coupons,
            currentPage: page,
            totalPages,
            search,
            admin: req.session.admin,
           
        });

    } catch (error) {
        console.error('Error loading coupon page:', error);
        res.status(STATUS.INTERNAL_ERROR).render('admin/admin-error', {
            pageTitle: 'Admin Error',
            heading: 'Oops! Something Went Wrong',
            userName: 'Admin',
            imageURL: '/images/admin-avatar.jpg',
            errorMessage: MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

export const addCoupon = async (req, res) => {
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
            discountType = 'fixed',
            maxDiscount
        } = req.body;

        const errors = [];

        if (!name || name.trim().length < 3) errors.push('Coupon name must be at least 3 characters');
        if (!couponCode || couponCode.trim().length < 4) errors.push('Coupon code must be at least 4 characters');
        if (!['fixed', 'percentage'].includes(discountType)) errors.push('Invalid discount type');
        if (!startDate) errors.push('Start date is required');
        if (!expireOn) errors.push('Expire date is required');
        if (!offerPrice) errors.push('Offer price is required');
        if (!minimumPrice) errors.push('Minimum price is required');
        if (!usageLimit) errors.push('Usage limit is required');

        const startDateObj = new Date(startDate);
        const expireDateObj = new Date(expireOn);

        if (isNaN(startDateObj.getTime())) errors.push('Invalid start date format');
        if (isNaN(expireDateObj.getTime())) errors.push('Invalid expire date format');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (startDateObj < today) errors.push('Start date cannot be in the past');
        if (expireDateObj <= startDateObj) errors.push('Expire date must be after start date');

        const offer = parseFloat(offerPrice);
        if (isNaN(offer) || offer <= 0) {
            errors.push('Offer price must be a positive number');
        } else if (discountType === 'percentage') {
            if (offer > 90) errors.push('Percentage discount cannot exceed 90%');
            if (offer < 1) errors.push('Percentage discount must be at least 1%');
        }

        const minPrice = parseFloat(minimumPrice);
        if (isNaN(minPrice) || minPrice < 0) errors.push('Minimum order amount must be 0 or greater');

        if (discountType === 'fixed' && offer > minPrice) {
            errors.push('Fixed discount cannot exceed the minimum order amount');
        }
        let parsedMaxDiscount = null;

if (discountType === 'percentage') {
    if (maxDiscount !== undefined && maxDiscount !== '') {
        parsedMaxDiscount = parseFloat(maxDiscount);
        if (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0) {
            errors.push('Max discount must be a valid number ≥ 0');
        }
    }
} else {
    parsedMaxDiscount = null; // force clear for fixed discount
}

if (
    discountType === 'percentage' &&
    parsedMaxDiscount !== null &&
    parsedMaxDiscount < (offer * minPrice) / 100
) {
    errors.push('Max discount is too low and will always cap the discount');
}


        const limit = parseInt(usageLimit, 10);
        if (isNaN(limit) || limit <= 0) errors.push('Usage limit must be a positive integer');

        if (errors.length > 0) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.VALIDATION.FIX_ERRORS + ': ' + errors.join('; ')
            });
        }

        const code = couponCode.trim().toUpperCase();
        const existing = await Coupon.findOne({ couponCode: code });
        if (existing) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.COUPON.ALREADY_EXISTS || 'This coupon code already exists'
            });
        }

        const newCoupon = new Coupon({
            name: name.trim(),
            couponCode: code,
            startDate: startDateObj,
            expireOn: expireDateObj,
            offerPrice: offer,
            minimumPrice: minPrice,
            usageLimit: limit,
            description: description?.trim() || '',
            discountType,
            maxDiscount: parsedMaxDiscount,
            isListed: true
        });

        const saved = await newCoupon.save();

        res.json({
            success: true,
            message: MESSAGES.COUPON.CREATED_SUCCESS || 'Coupon created successfully',
            coupon: saved
        });

    } catch (error) {
        console.error('Error in addCoupon:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

export const getCouponById = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.COUPON.NOT_FOUND || 'Coupon not found'
            });
        }
        res.json({ success: true, coupon });
    } catch (error) {
        console.error('Error getting coupon:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

export const updateCoupon = async (req, res) => {
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
            discountType = 'fixed',
            maxDiscount
        } = req.body;

        const errors = [];

        if (!name || name.trim().length < 3) errors.push('Coupon name must be at least 3 characters');
        if (!couponCode || couponCode.trim().length < 4) errors.push('Coupon code must be at least 4 characters');
        if (!['fixed', 'percentage'].includes(discountType)) errors.push('Invalid discount type');

        const startDateObj = new Date(startDate);
        const expireDateObj = new Date(expireOn);

        if (isNaN(startDateObj.getTime())) errors.push('Invalid start date');
        if (isNaN(expireDateObj.getTime())) errors.push('Invalid expire date');
        if (expireDateObj <= startDateObj) errors.push('Expire date must be after start date');

        const offer = parseFloat(offerPrice);
        if (isNaN(offer) || offer <= 0) {
            errors.push('Offer price must be positive');
        } else if (discountType === 'percentage') {
            if (offer > 100) errors.push('Percentage discount cannot exceed 100%');
            if (offer < 1) errors.push('Percentage discount must be at least 1%');
        }

        const minPrice = parseFloat(minimumPrice);
        if (isNaN(minPrice) || minPrice < 0) errors.push('Minimum price must be ≥ 0');

       let parsedMaxDiscount = null;

if (discountType === 'percentage') {
    if (maxDiscount !== undefined && maxDiscount !== '') {
        parsedMaxDiscount = parseFloat(maxDiscount);
        if (isNaN(parsedMaxDiscount) || parsedMaxDiscount < 0) {
            errors.push('Max discount must be a valid number ≥ 0');
        }
    }
} else {
    parsedMaxDiscount = null;
}
if (
    discountType === 'percentage' &&
    parsedMaxDiscount !== null &&
    parsedMaxDiscount < (offer * minPrice) / 100
) {
    errors.push('Max discount is too low and will always cap the discount');
}


        if (discountType === 'fixed' && offer > minPrice) {
            errors.push('Fixed discount cannot exceed minimum order amount');
        }

        const limit = parseInt(usageLimit, 10);
        if (isNaN(limit) || limit <= 0) errors.push('Usage limit must be ≥ 1');

        if (errors.length > 0) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.VALIDATION.FIX_ERRORS + ': ' + errors.join('; ')
            });
        }

        const code = couponCode.trim().toUpperCase();
        const existing = await Coupon.findOne({
            couponCode: code,
            _id: { $ne: couponId }
        });

        if (existing) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.COUPON.CODE_ALREADY_USED || 'This coupon code is already used by another coupon'
            });
        }

        const updated = await Coupon.findByIdAndUpdate(
            couponId,
            {
                name: name.trim(),
                couponCode: code,
                startDate: startDateObj,
                expireOn: expireDateObj,
                offerPrice: offer,
                minimumPrice: minPrice,
                usageLimit: limit,
                description: description?.trim() || '',
                discountType,
                maxDiscount: parsedMaxDiscount
            },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.COUPON.NOT_FOUND || 'Coupon not found'
            });
        }

        res.json({
            success: true,
            message: MESSAGES.COUPON.UPDATED_SUCCESS || 'Coupon updated successfully',
            coupon: updated
        });

    } catch (error) {
        console.error('Error updating coupon:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

export const toggleCouponStatus = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.COUPON.NOT_FOUND || 'Coupon not found'
            });
        }

        coupon.isListed = !coupon.isListed;
        await coupon.save();

        res.json({
            success: true,
            message: coupon.isListed 
                ? (MESSAGES.COUPON.ACTIVATED || 'Coupon activated successfully')
                : (MESSAGES.COUPON.DEACTIVATED || 'Coupon deactivated successfully'),
            isListed: coupon.isListed
        });
    } catch (error) {
        console.error('Error toggling coupon:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};

export const deleteCoupon = async (req, res) => {
    try {
        const result = await Coupon.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.COUPON.NOT_FOUND || 'Coupon not found'
            });
        }
        res.json({
            success: true,
            message: MESSAGES.COUPON.DELETED_SUCCESS || 'Coupon deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG
        });
    }
};