
const mongoose = require('mongoose')
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema')
const Brand = require('../../models/brandSchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp')
const multer  = require('multer')



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

      // Validate ObjectId
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
      // Handle images
      let productImages = [...(product.productImages || [])];


      // Process existing images
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

      // Process new uploaded images
      if (req.files && req.files.length > 0) {
        req.files.forEach((file) => {
          const match = file.originalname.match(/^image(\d+)\.jpg$/);
          if (match) {
            const index = parseInt(match[1]) - 1;
            // Delete old image if it exists
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
            // Update with new image
            productImages[index] = file.filename;
          }
        });
      }

      // Ensure at least 3 images
      if (productImages.filter(Boolean).length < 3) {
        console.error('Insufficient images:', productImages);
        return res.status(400).json({
          success: false,
          message: 'At least three product images are required',
        });
      }

      // Update product
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
