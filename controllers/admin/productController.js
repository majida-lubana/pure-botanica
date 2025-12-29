
const mongoose = require('mongoose')
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema')
const Brand = require('../../models/brandSchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp')
const multer  = require('multer')
const Cart = require('../../models/cartSchema')
const STATUS = require('../../constants/statusCode')
const MESSAGES = require('../../constants/messages');


exports.getproductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render('admin/add-product', { cat: category,currentPage: 'add-product' });
    } catch (error) {
        console.error('Error loading product add page:', error);
        res.redirect('/pageError');
    }
};


exports.addProducts = async (req, res) => {
  try {
      console.log('Request body:', req.body);
      console.log('Uploaded Files:', req.files);

      if (!req.files || req.files.length === 0) {
          console.error('No files uploaded');
          return res.status(STATUS.BAD_REQUEST).json({ 
              success: false,
              error: MESSAGES.PRODUCT.IMAGE_REQUIRED || 'At least one product image is required'
          });
      }

      const products = req.body;

      if (!products.skinType || products.skinType.trim() === '') {
          return res.status(STATUS.BAD_REQUEST).json({ 
              success: false, 
              error: MESSAGES.PRODUCT.SKIN_TYPE_REQUIRED || 'Skin Type is required' 
          });
      }

      if (!products.skinConcern || products.skinConcern.trim() === '') {
          return res.status(STATUS.BAD_REQUEST).json({ 
              success: false, 
              error: MESSAGES.PRODUCT.SKIN_CONCERN_REQUIRED || 'Skin Concern is required' 
          });
      }

      const productExists = await Product.findOne({ productName: products.productName });
      if (productExists) {
          req.files.forEach(file => {
              if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          });
          return res.status(STATUS.BAD_REQUEST).json({ 
              success: false, 
              error: MESSAGES.PRODUCT.ALREADY_EXISTS || 'Product already exists, please try with another name'
          });
      }

      const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
      if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
      }

      const images = [];
      for (let i = 0; i < req.files.length; i++) {
          try {
              const originalImagePath = req.files[i].path;
              const filename = req.files[i].filename;
              const resizedFilename = `resized-${Date.now()}-${filename}.jpeg`;
              const savePath = path.join(uploadDir, resizedFilename);

              console.log(`Saving image ${i + 1} to: ${savePath}`);
              await sharp(originalImagePath)
                  .resize(440, 440)
                  .toFormat('jpeg')
                  .jpeg({ quality: 90 })
                  .toFile(savePath);

              images.push(resizedFilename);

              if (fs.existsSync(originalImagePath)) {
                  fs.unlinkSync(originalImagePath);
              }
          } catch (err) {
              console.error(`Error processing image ${i + 1}:`, err);
              // Continue processing other images even if one fails
          }
      }

      const categoryId = await Category.findOne({ categoryName: products.category });
      if (!categoryId) {
          // Clean up uploaded images if category is invalid
          images.forEach(img => {
              const imgPath = path.join(uploadDir, img);
              if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
          });
          return res.status(STATUS.BAD_REQUEST).json({ 
              success: false,
              error: MESSAGES.PRODUCT.INVALID_CATEGORY || 'Invalid category name'
          });
      }

      const newProduct = new Product({
          productName: products.productName,
          description: products.description,
          brand: products.brand || '',
          category: categoryId._id,
          regularPrice: products.regularPrice,
          salePrice: products.salePrice || 0,
          createdOn: new Date(),
          quantity: products.quantity,
          skinType: products.skinType,
          skinConcern: products.skinConcern,
          howToUse: products.howToUse,
          productImages: images,
          status: 'Available',
      });

      const savedProduct = await newProduct.save();
      console.log('Product saved with ID:', savedProduct._id);

      const verifyProduct = await Product.findById(savedProduct._id);
      if (!verifyProduct) {
          console.error('Product was not found in database after save');
          return res.status(STATUS.INTERNAL_ERROR).json({
              success: false,
              error: MESSAGES.PRODUCT.VERIFY_FAILED || 'Failed to verify product in database'
          });
      }

      console.log('Verified product in database:', verifyProduct);

      return res.status(STATUS.OK).json({
          success: true,
          message: MESSAGES.PRODUCT.ADDED_SUCCESS || 'Product added successfully',
          redirectUrl: '/admin/product-list',
          productId: savedProduct._id
      });

  } catch (error) {
      console.error('Error saving product:', error);

      // Clean up any uploaded/resized images on failure
      if (req.files) {
          req.files.forEach(file => {
              if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          });
      }

      const uploadDir = path.join(__dirname, '../../public/uploads/product-images');
      // Optional: clean up any partially saved resized images (if needed)

      return res.status(STATUS.INTERNAL_ERROR).json({
          success: false,
          error: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'An error occurred while adding the product',
          details: error.message
      });
  }
};

exports.blockProduct = async (req, res) => {
  try {
    const id = req.params.id;

    // Optional: Validate ObjectId to prevent invalid queries
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

    // If no document was modified, the product likely doesn't exist
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

exports.unblockProduct = async (req, res) => {
  try {
    const id = req.params.id;

    // Optional: Validate ObjectId for safety
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

    // Check if any document was actually modified
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

exports.addProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!productId) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.OFFER_ID_REQUIRED || 'Product ID is required in the URL parameters' 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.INVALID_ID || 'Invalid product ID format. Must be a valid MongoDB ObjectId' 
      });
    }

    const offerPercentageRaw = req.body.offerPercentage;

    if (offerPercentageRaw === undefined || offerPercentageRaw === null) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.OFFER_PERCENT_REQUIRED || 'Offer percentage is required in the request body' 
      });
    }

    if (typeof offerPercentageRaw !== 'string' && typeof offerPercentageRaw !== 'number') {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.OFFER_PERCENT_TYPE || 'Offer percentage must be a number or numeric string' 
      });
    }

    const trimmedValue = typeof offerPercentageRaw === 'string' ? offerPercentageRaw.trim() : offerPercentageRaw;

    if (typeof trimmedValue === 'string' && trimmedValue === '') {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.OFFER_PERCENT_EMPTY || 'Offer percentage cannot be empty' 
      });
    }

    const offerPercentage = parseInt(trimmedValue, 10);

    if (isNaN(offerPercentage)) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.OFFER_PERCENT_NAN || 'Offer percentage must be a valid numeric value' 
      });
    }

    if (offerPercentage.toString() !== trimmedValue.toString().replace(/\..*$/, '')) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.OFFER_PERCENT_WHOLE || 'Offer percentage must be a whole number (no decimals)' 
      });
    }

    if (offerPercentage < 1 || offerPercentage > 90) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.OFFER_PERCENT_RANGE || 'Offer percentage must be between 1 and 90 inclusive' 
      });
    }

    const product = await Product.findById(productId).select('salePrice productOffer name');

    if (!product) {
      return res.status(STATUS.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.NOT_FOUND || 'Product not found with the provided ID' 
      });
    }

    if (!product.salePrice || typeof product.salePrice !== 'number' || product.salePrice <= 0) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.INVALID_SALE_PRICE || 'Product has an invalid sale price. Cannot apply offer' 
      });
    }

    if (product.productOffer === offerPercentage) {
      const currentPrice = product.salePrice * (1 - offerPercentage / 100);
      return res.json({
        success: true,
        message: MESSAGES.PRODUCT.OFFER_ALREADY_APPLIED || 'Offer already applied at this percentage',
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

    console.log(`Offer added: ${product.name} (${productId}) → ${offerPercentage}%`);
    console.log(`Discounted price: ₹${newPrice.toFixed(2)} (from ₹${product.salePrice.toFixed(2)})`);
    console.log(`Updated ${cartsUpdatedCount} cart(s)`);

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
    console.error('Add Offer Error:', {
      message: error.message,
      stack: error.stack,
      productId: req.params.id,
      body: req.body
    });

    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Internal server error. Please try again later.'
    });
  }
};

exports.removeProductOffer = async (req, res) => {
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

    // Remove the offer
    product.productOffer = 0;
    await product.save();

    const originalPrice = product.salePrice;

    // Update all carts that contain this product
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

    console.log(`Offer removed: ${productId} (${product.name || 'Unknown'})`);
    console.log(`Restored original price: ₹${originalPrice.toFixed(2)}`);
    console.log(`Updated ${cartsUpdatedCount} cart(s)`);

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
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Server error'
    });
  }
};

exports.getEditProduct = async (req, res) => {
  try {
    const id = req.params.id;
    console.log(`Attempting to fetch product with ID: ${id}`);

    if (!mongoose.isValidObjectId(id)) {
      console.error('Invalid product ID:', id);
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
      console.error('Product not found for ID:', id);
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
      console.error('No categories found');
      return res.status(STATUS.NOT_FOUND).render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'No Categories Found',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        errorMessage: MESSAGES.PRODUCT.NO_CATEGORIES || 'No categories are available to assign to the product.'
      });
    }

    console.log('Rendering edit-product with product:', product._id, 'and categories:', categories.length);
    res.render('admin/edit-product', {
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
      errorMessage: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'A server-side error occurred. Please try again later.'
    });
  }
};

exports.updateProduct = async (req, res) => {
    try {
      console.log('Update product request body:', req.body);
      console.log('Request Files:', req.files);

      const id = req.params.id;
      console.log("Product update ID:", id);

      if (!mongoose.isValidObjectId(id)) {
        console.error('Invalid product ID:', id);
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.PRODUCT.INVALID_ID || 'Invalid product ID'
        });
      }

      const product = await Product.findById(id);
      if (!product) {
        console.error('Product not found for ID:', id);
        return res.status(STATUS.NOT_FOUND).json({
          success: false,
          message: MESSAGES.PRODUCT.NOT_FOUND || 'Product not found'
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
        existingImages,
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
        stock === undefined || stock === ''
      ) {
        console.error('Missing required fields');
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.PRODUCT.REQUIRED_FIELDS || 'All required fields must be provided'
        });
      }

      const parsedStock = Number(stock);
      if (isNaN(parsedStock) || parsedStock < 0) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.PRODUCT.INVALID_QUANTITY || 'Quantity must be a valid non-negative number'
        });
      }

      let productImages = [...(product.productImages || [])];

      const existingImagesArray = Array.isArray(existingImages)
        ? existingImages
        : existingImages ? [existingImages] : [];

      existingImagesArray.forEach((img, index) => {
        if (img && index < productImages.length) {
          productImages[index] = img;
        }
      });

      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          const match = file.originalname.match(/^image(\d+)\.jpg$/);
          if (match) {
            const index = parseInt(match[1]) - 1;

            if (productImages[index]) {
              const oldImagePath = path.join(
                __dirname,
                '../../public/uploads/product-images',  // Fixed path to match addProducts
                productImages[index]
              );
              if (fs.existsSync(oldImagePath)) {
                console.log('Deleting old image:', oldImagePath);
                fs.unlinkSync(oldImagePath);
              }
            }

            productImages[index] = file.filename;
          }
        });
      }

      if (productImages.filter(Boolean).length < 3) {
        console.error('Insufficient images:', productImages);
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.PRODUCT.MIN_IMAGES_REQUIRED || 'At least three product images are required'
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
          productImages,
        },
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        console.error('Failed to update product for ID:', id);
        return res.status(STATUS.NOT_FOUND).json({
          success: false,
          message: MESSAGES.PRODUCT.NOT_FOUND || 'Product not found'
        });
      }

      console.log('Product updated successfully:', updatedProduct._id);
      return res.json({
        success: true,
        message: MESSAGES.PRODUCT.UPDATED_SUCCESS || 'Product updated successfully'
      });

    } catch (error) {
      console.error('Error updating product:', error.stack);
      return res.status(STATUS.INTERNAL_ERROR).json({
        success: false,
        message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'An error occurred while updating the product'
      });
    }
};
exports.getAllproducts = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    // Build query only if search is provided
    const query = search
      ? {
          $or: [
            { productName: { $regex: new RegExp(search, "i") } },
            { brand: { $regex: new RegExp(search, "i") } },
          ],
        }
      : {};

    const productData = await Product.find(query)
      .populate("category")
      .sort({ createdOn: -1 }) // Optional: better UX with newest first
      .skip(skip)
      .limit(limit)
      .lean();

    const count = await Product.countDocuments(query);

    const category = await Category.find({ isListed: true }).lean();
    const brand = await Brand.find({ isBlocked: false }).lean();

    // Always render the product list — even if no categories/brands (admin can still manage products)
    res.render("admin/product-list", {
      products: productData,
      currentPage: page,
      totalPages: Math.ceil(count / limit) || 1,
      totalProducts: count,
      cat: category,
      brand: brand,
      search, // Pass search term back to view for persistence
    });

  } catch (error) {
    console.error("Error in getAllproducts:", error);
    res.status(STATUS.INTERNAL_ERROR).render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Oops! Something Went Wrong',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      errorMessage: MESSAGES.PRODUCT.LOAD_FAILED || 'Failed to load products. Please try again later.'
    });
  }
};
