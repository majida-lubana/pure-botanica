import mongoose from 'mongoose';
import Category from '../../models/categorySchema.js';
import Product from '../../models/productSchema.js';

import Cart from '../../models/cartSchema.js';

import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js';






export const getproductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render('admin/add-product', { 
            layout: 'layouts/adminLayout',
            cat: category,
            currentPage: 'add-product' 
        });
    } catch (error) {
        console.error('Error loading product add page:', error);
        res.redirect('/pageError');
    }
};

export const addProducts = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("Uploaded files:", req.files);

    if (!req.files || req.files.length === 0) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: MESSAGES.PRODUCT.IMAGE_REQUIRED || "At least one product image is required"
      });
    }

    const products = req.body;

    if (!products.skinType?.trim()) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: MESSAGES.PRODUCT.SKIN_TYPE_REQUIRED
      });
    }

    if (!products.skinConcern?.trim()) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: MESSAGES.PRODUCT.SKIN_CONCERN_REQUIRED
      });
    }

    const productExists = await Product.findOne({
      productName: products.productName
    });

    if (productExists) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: MESSAGES.PRODUCT.ALREADY_EXISTS
      });
    }

    
    const images = req.files.map(file => file.path);


    const category = await Category.findOne({
      categoryName: products.category
    });

    if (!category) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: MESSAGES.PRODUCT.INVALID_CATEGORY
      });
    }

    const newProduct = new Product({
      productName: products.productName,
      description: products.description,
      category: category._id,
      regularPrice: products.regularPrice,
      salePrice: products.salePrice || 0,
      createdOn: new Date(),
      quantity: products.quantity,
      skinType: products.skinType,
      skinConcern: products.skinConcern,
      howToUse: products.howToUse,
      productImages: images,
      status: "Available"
    });

    const savedProduct = await newProduct.save();

    return res.status(STATUS.OK).json({
      success: true,
      message: MESSAGES.PRODUCT.ADDED_SUCCESS,
      redirectUrl: "/admin/product-list",
      productId: savedProduct._id
    });

  } catch (error) {
    console.error("Error saving product:", error);

    return res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      error: MESSAGES.COMMON.SOMETHING_WENT_WRONG,
      details: error.message
    });
  }
};


export const blockProduct = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.json({
        success: false,
        message: MESSAGES.PRODUCT.INVALID_ID || 'Invalid product ID'
      });
    }

    const result = await Product.updateOne(
      { _id: id },
      { $set: { isBlocked: true } }
    );

    if (result.modifiedCount === 0) {
      return res.json({
        success: false,
        message: MESSAGES.PRODUCT.NOT_FOUND || 'Product not found'
      });
    }

    res.json({
      success: true,
      isListed: false,
      message: MESSAGES.PRODUCT.BLOCKED_SUCCESS || 'Product unlisted successfully'
    });
  } catch (error) {
    console.error('Error blocking product:', error);
    res.json({
      success: false,
      message: MESSAGES.PRODUCT.BLOCK_FAILED || 'Error while unlisting product'
    });
  }
};

export const unblockProduct = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.json({
        success: false,
        message: MESSAGES.PRODUCT.INVALID_ID || 'Invalid product ID'
      });
    }

    const result = await Product.updateOne(
      { _id: id },
      { $set: { isBlocked: false } }
    );

    if (result.modifiedCount === 0) {
      return res.json({
        success: false,
        message: MESSAGES.PRODUCT.NOT_FOUND || 'Product not found'
      });
    }

    res.json({
      success: true,
      isListed: true,
      message: MESSAGES.PRODUCT.UNBLOCKED_SUCCESS || 'Product listed successfully'
    });
  } catch (error) {
    console.error('Error unblocking product:', error);
    res.json({
      success: false,
      message: MESSAGES.PRODUCT.UNBLOCK_FAILED || 'Error while listing product'
    });
  }
};

export const addProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.INVALID_ID || 'Invalid product ID' 
      });
    }

    const offerPercentageRaw = req.body.offerPercentage;

    if (offerPercentageRaw === undefined || offerPercentageRaw === null || 
        (typeof offerPercentageRaw === 'string' && offerPercentageRaw.trim() === '')) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.OFFER_PERCENT_REQUIRED || 'Offer percentage is required' 
      });
    }

    const offerPercentage = parseInt(String(offerPercentageRaw).trim(), 10);

    if (isNaN(offerPercentage) || offerPercentage < 1 || offerPercentage > 90) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.OFFER_PERCENT_RANGE || 'Offer percentage must be between 1 and 90' 
      });
    }

    const product = await Product.findById(productId).select('salePrice productOffer name');

    if (!product) {
      return res.status(STATUS.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.NOT_FOUND || 'Product not found' 
      });
    }

    if (product.productOffer === offerPercentage) {
      const currentPrice = product.salePrice * (1 - offerPercentage / 100);
      return res.json({
        success: true,
        message: MESSAGES.PRODUCT.OFFER_ALREADY_APPLIED || 'Offer already applied',
        offerPercentage,
        newPrice: currentPrice.toFixed(2),
        originalPrice: product.salePrice.toFixed(2),
        cartsUpdated: 0
      });
    }

    product.productOffer = offerPercentage;
    await product.save();

    const newPrice = Number((product.salePrice * (1 - offerPercentage / 100)).toFixed(2));

    const carts = await Cart.find({ 'items.productId': productId });
    let cartsUpdatedCount = 0;

    for (const cart of carts) {
      let cartUpdated = false;
      for (const item of cart.items) {
        if (item.productId.toString() === productId.toString()) {
          item.price = newPrice;
          item.totalPrice = Number((newPrice * item.quantity).toFixed(2));
          item.updatedAt = new Date();
          cartUpdated = true;
        }
      }
      if (cartUpdated) {
        await cart.save();
        cartsUpdatedCount++;
      }
    }

    res.json({
      success: true,
      message: MESSAGES.PRODUCT.OFFER_ADDED_SUCCESS || 'Offer applied successfully',
      productId,
      productName: product.name,
      offerPercentage,
      originalPrice: product.salePrice.toFixed(2),
      newPrice: newPrice.toFixed(2),
      savings: (product.salePrice - newPrice).toFixed(2),
      cartsUpdated: cartsUpdatedCount
    });

  } catch (error) {
    console.error('Add Offer Error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};

export const removeProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.INVALID_ID || 'Invalid product ID' 
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(STATUS.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.NOT_FOUND || 'Product not found' 
      });
    }

    product.productOffer = 0;
    await product.save();

    const originalPrice = product.salePrice;

    const carts = await Cart.find({ 'items.productId': productId });
    let cartsUpdatedCount = 0;

    for (const cart of carts) {
      let updated = false;
      cart.items.forEach(item => {
        if (item.productId.toString() === productId.toString()) {
          item.price = originalPrice;
          item.totalPrice = Number((originalPrice * item.quantity).toFixed(2));
          item.updatedAt = new Date();
          updated = true;
        }
      });

      if (updated) {
        await cart.save();
        cartsUpdatedCount++;
      }
    }

    res.json({
      success: true,
      message: MESSAGES.PRODUCT.OFFER_REMOVED_SUCCESS || 'Offer removed successfully',
      offerPercentage: 0,
      newPrice: originalPrice.toFixed(2),
      originalPrice: originalPrice.toFixed(2),
      cartsUpdated: cartsUpdatedCount
    });

  } catch (error) {
    console.error('Remove Offer Error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};

export const getEditProduct = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(STATUS.BAD_REQUEST).render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'Invalid Product ID',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        errorMessage: MESSAGES.PRODUCT.INVALID_ID || 'The provided product ID is invalid.'
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(STATUS.NOT_FOUND).render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'Product Not Found',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        errorMessage: MESSAGES.PRODUCT.NOT_FOUND || 'The requested product was not found.'
      });
    }

    const categories = await Category.find({});
    if (!categories || categories.length === 0) {
      return res.status(STATUS.NOT_FOUND).render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'No Categories Found',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        errorMessage: MESSAGES.PRODUCT.NO_CATEGORIES || 'No categories are available.'
      });
    }

    res.render('admin/edit-product', {
      layout: 'layouts/adminLayout',
      product,
      categories,
      currentPage: 'product',
    });
  } catch (error) {
    console.error('Error in getEditProduct:', error);
    res.status(STATUS.INTERNAL_ERROR).render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Server Error',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      errorMessage: MESSAGES.COMMON.SOMETHING_WENT_WRONG
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PRODUCT.INVALID_ID
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.PRODUCT.NOT_FOUND
      });
    }

    const {
      productName,
      productDescription,
      howToUse,
      category,
      skinType,
      skinConcern,
      regularPrice,
      salePrice,
      stock,
      existingImages
    } = req.body;

    if (
      !productName ||
      !productDescription ||
      !howToUse ||
      !category ||
      !skinType ||
      !skinConcern ||
      !regularPrice ||
      !salePrice ||
      stock === undefined
    ) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PRODUCT.REQUIRED_FIELDS
      });
    }

    const parsedStock = Number(stock);
    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PRODUCT.INVALID_QUANTITY
      });
    }

  
    let productImages = Array.isArray(existingImages)
  ? [...existingImages]
  : existingImages
    ? [existingImages]
    : [...product.productImages];

if (req.files && req.files.length > 0) {
  const newImages = req.files.map(file => file.path);
  productImages = [...productImages, ...newImages];
}

productImages = productImages.filter(Boolean);

if (productImages.length < 3) {
  return res.status(STATUS.BAD_REQUEST).json({
    success: false,
    message: MESSAGES.PRODUCT.MIN_IMAGES_REQUIRED
  });
}


    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        productName,
        description: productDescription,
        howToUse,
        category,
        skinType,
        skinConcern,
        regularPrice,
        salePrice,
        quantity: parsedStock,
        productImages
      },
      { new: true, runValidators: true }
    );

    return res.json({
      success: true,
      message: MESSAGES.PRODUCT.UPDATED_SUCCESS,
      product:updatedProduct
    });

  } catch (error) {
    console.error("Error updating product:", error);
    return res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG
    });
  }
};


export const getAllproducts = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const query = search
      ? {
          $or: [
            { productName: { $regex: new RegExp(search, "i") } },
          ],
        }
      : {};

    const productData = await Product.find(query)
      .populate("category")
      .sort({ createdOn: -1 }) 
      .skip(skip)
      .limit(limit)
      .lean();

    const count = await Product.countDocuments(query);

    const category = await Category.find({ isListed: true }).lean();
    

    const prod = await Product.find().lean();
    const totalPrice = prod.reduce((sum, item) => sum + (item.salePrice || 0), 0);

    res.render("admin/product-list", {
      layout: 'layouts/adminLayout',
      products: productData,
      currentPage: page,
      totalPages: Math.ceil(count / limit) || 1,
      totalProducts: count,
      cat: category,
      search,
      totalPrice
    });

  } catch (error) {
    console.error("Error in getAllproducts:", error);
    res.status(STATUS.INTERNAL_ERROR).render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Oops! Something Went Wrong',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      errorMessage: MESSAGES.PRODUCT.LOAD_FAILED || 'Failed to load products.'
    });
  }
};