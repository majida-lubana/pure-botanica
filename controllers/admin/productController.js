
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
          return res.status(400).json({ error: 'At least one product image is required' });
      }

      const products = req.body;

 
      if (!products.skinType || products.skinType.trim() === '') {
          return res.status(400).json({ 
              success: false, 
              error: 'Skin Type is required' 
          });
      }

      if (!products.skinConcern || products.skinConcern.trim() === '') {
          return res.status(400).json({ 
              success: false, 
              error: 'Skin Concern is required' 
          });
      }

      const productExists = await Product.findOne({ productName: products.productName });
      if (productExists) {
          req.files.forEach(file => {
              if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          });
          return res.status(400).json({ 
              success: false, 
              error: 'Product already exists, please try with another name' 
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
          }
      }

   
      const categoryId = await Category.findOne({ categoryName: products.category });
      if (!categoryId) {
          return res.status(400).json({ error: 'Invalid category name' });
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
          return res.status(500).json({
              success: false,
              error: 'Failed to verify product in database'
          });
      }

      console.log('Verified product in database:', verifyProduct);

      return res.status(200).json({
          success: true,
          message: 'Product added successfully',
          redirectUrl: '/admin/product-list',
          productId: savedProduct._id
      });
  } catch (error) {
      console.error('Error saving product:', error);

      if (req.files) {
          req.files.forEach(file => {
              if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          });
      }

      return res.status(500).json({
          success: false,
          error: 'An error occurred while adding the product',
          details: error.message
      });
  }
};



exports.blockProduct = async (req, res) => {
  try {
    let id = req.params.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });
    res.json({
      success: true,
      isListed: false,
      message: 'Product unlisted successfully'
    });
  } catch (error) {
    res.json({
      success: false,
      message: 'Error while unlisting product'
    });
  }
};

exports.unblockProduct = async (req, res) => {
  try {
    let id = req.params.id;
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
    res.json({
      success: true,
      isListed: true,
      message: 'Product listed successfully'
    });
  } catch (error) {
    res.json({
      success: false,
      message: 'Error while listing product'
    });
  }
};


// Add Product Offer
exports.addProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;

   
    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product ID is required in the URL parameters' 
      });
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid product ID format. Must be a valid MongoDB ObjectId' 
      });
    }


    const offerPercentageRaw = req.body.offerPercentage;


    if (offerPercentageRaw === undefined || offerPercentageRaw === null) {
      return res.status(400).json({ 
        success: false, 
        message: 'Offer percentage is required in the request body' 
      });
    }


    if (typeof offerPercentageRaw !== 'string' && typeof offerPercentageRaw !== 'number') {
      return res.status(400).json({ 
        success: false, 
        message: 'Offer percentage must be a number or numeric string' 
      });
    }


    const trimmedValue = typeof offerPercentageRaw === 'string' ? offerPercentageRaw.trim() : offerPercentageRaw;


    if (typeof trimmedValue === 'string' && trimmedValue === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Offer percentage cannot be empty' 
      });
    }


    const offerPercentage = parseInt(trimmedValue, 10);


    if (isNaN(offerPercentage)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Offer percentage must be a valid numeric value' 
      });
    }


    if (offerPercentage.toString() !== trimmedValue.toString().replace(/\..*$/, '')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Offer percentage must be a whole number (no decimals)' 
      });
    }

    if (offerPercentage < 1 || offerPercentage > 90) {
      return res.status(400).json({ 
        success: false, 
        message: 'Offer percentage must be between 1 and 90 inclusive' 
      });
    }


    const product = await Product.findById(productId).select('salePrice productOffer name');

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found with the provided ID' 
      });
    }


    if (!product.salePrice || typeof product.salePrice !== 'number' || product.salePrice <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product has an invalid sale price. Cannot apply offer' 
      });
    }


    if (product.productOffer === offerPercentage) {
      const currentPrice = product.salePrice - (product.salePrice * offerPercentage / 100);
      return res.json({
        success: true,
        message: 'Offer already applied at this percentage',
        offerPercentage,
        newPrice: currentPrice.toFixed(2),
        originalPrice: product.salePrice.toFixed(2),
        cartsUpdated: 0
      });
    }


    product.productOffer = offerPercentage;
    await product.save();


    const discountAmount = (product.salePrice * offerPercentage) / 100;
    const newPriceRaw = product.salePrice - discountAmount;
    const newPrice = Number(newPriceRaw.toFixed(2)); 


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
      message: 'Offer applied successfully',
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

    res.status(500).json({ 
      success: false, 
      message: 'Internal server error. Please try again later.' 
      
    });
  }
};

// Remove Product Offer
exports.removeProductOffer = async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    // Get the product
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Remove offer (set to 0)
    product.productOffer = 0;
    await product.save();

    // Reset price to original salePrice
    const originalPrice = product.salePrice;

    // Update all cart items that contain this product
    const carts = await Cart.find({ 'items.productId': productId });
    
    for (const cart of carts) {
      let updated = false;
      cart.items.forEach(item => {
        if (item.productId.toString() === productId.toString()) {
          item.price = originalPrice;
          item.totalPrice = originalPrice * item.quantity;
          item.updatedAt = new Date();
          updated = true;
        }
      });
      
      if (updated) {
        await cart.save();
      }
    }

    console.log(`Offer removed: ${productId}`);
    console.log(`Updated ${carts.length} cart(s) with original price: ₹${originalPrice.toFixed(2)}`);

    res.json({
      success: true,
      offerPercentage: 0,
      newPrice: originalPrice.toFixed(2),
      cartsUpdated: carts.length
    });
  } catch (error) {
    console.error('Remove Offer Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getEditProduct = async (req, res) => {
  try {
    const id = req.params.id;
    console.log(`Attempting to fetch product with ID: ${id}`);

    if (!mongoose.isValidObjectId(id)) {
      console.error('Invalid product ID:', id);
      return res.status(400).render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'Invalid Product ID',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        message: 'The provided product ID is invalid.',
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      console.error('Product not found for ID:', id);
      return res.status(404).render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'Product Not Found',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        message: 'The requested product was not found.',
      });
    }

    const categories = await Category.find({});
    if (!categories || categories.length === 0) {
      console.error('No categories found');
      return res.status(404).render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'No Categories Found',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        message: 'No categories are available to assign to the product.',
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
    res.status(500).render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Server Error',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      message: 'A server-side error occurred. Please try again later.',
    });
  }
};

exports.updateProduct = async (req, res) => {
    try {
      console.log('dsankndfkjnmfsndkdsfd,f,ksnkfsd:', req.body);
      console.log('Request Files:', req.files);

      const id = req.params.id;
      console.log("product update",id)

   
      if (!mongoose.isValidObjectId(id)) {
        console.error('Invalid product ID:', id);
        return res.status(400).json({
          success: false,
          message: 'Invalid product ID',
        });
      }

     
      const product = await Product.findById(id);
      if (!product) {
        console.error('Product not found for ID:', id);
        return res.status(404).json({
          success: false,
          message: 'Product not found',
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

       console.log("i am reached",req.body)
    
      if (
        !productName ||
        !productDescription ||
        !howToUse ||
        !category ||
        !skinType ||
        !skinConcern ||
        !regularPrice ||
        !salePrice ||
        !stock
      ) {
        console.error('Missing required fields:', {
          productName,
          productDescription,
          howToUse,
          category,
          skinType,
          skinConcern,
          regularPrice,
          salePrice,
          stock,
        });
        return res.status(400).json({
          success: false,
          message: 'All required fields must be provided',
        });
      }
      if(stock<0){
        return res.status(400).json({
          success :false,
          message:'Quantity cannot be negative',
        })
      }
  
      let productImages = [...(product.productImages || [])];



      const existingImagesArray = Array.isArray(existingImages)
        ? existingImages
        : existingImages
        ? [existingImages]
        : [];
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
                '../public/uploads/product-images',
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
        return res.status(400).json({
          success: false,
          message: 'At least three product images are required',
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
          quantity: stock,
          productImages,
        },
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        console.error('Failed to update product for ID:', id);
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      console.log('Product updated successfully:', updatedProduct._id);
      return res.json({
        success: true,
        message: 'Product updated successfully',
      });
    } catch (error) {
      console.error('Error updating product:', error.stack);
      return res.status(500).json({
        success: false,
        message: error.message || 'An error occurred while updating the product',
      });
    }
  }
exports.getAllproducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;

    const query = {
      $or: [
        { productName: { $regex: new RegExp(search, "i") } },
        { brand: { $regex: new RegExp(search, "i") } },
      ],
    };

    const productData = await Product.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
     

    const count = await Product.countDocuments(query);

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (category && brand) {
      res.render("admin/product-list", {
        products: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalProducts: count, 
        cat: category,
        brand: brand,
      });
    } else {
      res.render("page-404");
    }
  } catch (error) {
    console.error("Error in getAllproducts:", error.message);
    res.redirect("/admin/add-product");
  }
};
