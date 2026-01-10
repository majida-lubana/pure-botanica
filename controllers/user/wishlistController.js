

import mongoose from 'mongoose';
import Product from '../../models/productSchema.js';
import WishList from '../../models/wishlistSchema.js';

import calculatePricing from '../../utils/calculatePricing.js'; 
import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js';

export const getWishlist = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.redirect('/login');

    const wishlistDoc = await WishList.findOne({ user: userId })
      .populate({
        path: 'products.productId',
        select: 'productName productImages regularPrice salePrice quantity status isActive isBlocked category',
        match: { status: { $ne: 'Deleted' } }
      })
      .lean();

    let items = [];

    if (wishlistDoc?.products) {
      items = wishlistDoc.products
        .filter(p => p.productId) 
        .map(p => {
          const prod = p.productId;
          const pricing = calculatePricing(prod);

          return {
            product: {
              _id: prod._id.toString(),
              name: prod.productName || 'Unknown',
              images: Array.isArray(prod.productImages) ? prod.productImages : [],
              stock: prod.quantity ?? 0,
              assured: prod.assured ?? false,
              pricing
            },
            addedOn: p.addedOn
          };
        });
    }

    
    if (wishlistDoc && items.length !== wishlistDoc.products.length) {
      const keepIds = items.map(i => i.product._id);
      await WishList.updateOne(
        { user: userId },
        { $pull: { products: { productId: { $nin: keepIds } } } }
      );
    }

    res.render('user/wishlist', { wishlist: items, user: req.user });
  } catch (err) {
    console.error('getWishlist error:', err);
    res.status(STATUS.INTERNAL_ERROR).render('user/page-404', {
      message: MESSAGES.WISHLIST.LOAD_FAILED || 'Failed to load wishlist',
      pageTitle: 'Error'
    });
  }
};

export const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user?._id;

    if(!userId){
      return res.status(STATUS.BAD_REQUEST).json({
        success:false,
        message:MESSAGES.REQUIRED_LOGIN,
        redirectUrl:'/login'
      })
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.WISHLIST.INVALID_PRODUCT_ID || 'Invalid product ID'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.PRODUCT.NOT_FOUND || 'Product not found'
      });
    }

    let wishlist = await WishList.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await WishList.create({ user: userId, products: [] });
    }

    const idx = wishlist.products.findIndex(
      p => p.productId.toString() === productId
    );

    let added = false;
    if (idx === -1) {
      wishlist.products.push({ productId });
      added = true;
    } else {
      wishlist.products.splice(idx, 1);
    }

    await wishlist.save();

    res.json({
      success: true,
      added,
      message: added
        ? MESSAGES.WISHLIST.ADDED_SUCCESS || 'Added to wishlist'
        : MESSAGES.WISHLIST.REMOVED_SUCCESS || 'Removed from wishlist'
    });
  } catch (error) {
    console.error('toggleWishlist error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
    });
  }
};

export const removeFromWishList = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.WISHLIST.INVALID_PRODUCT_ID || 'Invalid product ID'
      });
    }

    const wishlist = await WishList.findOne({ user: userId });
    if (!wishlist) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.WISHLIST.NOT_FOUND || 'Wishlist not found'
      });
    }

    const idx = wishlist.products.findIndex(
      p => p.productId.toString() === productId
    );

    if (idx === -1) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.WISHLIST.ITEM_NOT_FOUND || 'Product not in wishlist'
      });
    }

    wishlist.products.splice(idx, 1);
    await wishlist.save();

    res.json({
      success: true,
      message: MESSAGES.WISHLIST.REMOVED_SUCCESS || 'Removed from wishlist'
    });
  } catch (error) {
    console.error('removeFromWishList error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
    });
  }
};

export const getWishListCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await WishList.findOne({ user: userId });
    const count = wishlist ? wishlist.products.length : 0;

    res.json({ success: true, count });
  } catch (error) {
    console.error('getWishListCount error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
    });
  }
};

export const clearWishList = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await WishList.deleteOne({ user: userId });

    if (result.deletedCount === 0) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.WISHLIST.NOT_FOUND || 'Wishlist not found'
      });
    }

    res.json({
      success: true,
      message: MESSAGES.WISHLIST.CLEARED_SUCCESS || 'Wishlist cleared'
    });
  } catch (error) {
    console.error('clearWishList error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
    });
  }
};