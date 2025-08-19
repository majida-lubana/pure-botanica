const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema')
const Brand = require('../../models/brandSchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp')



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

   
      const categoryId = await Category.findOne({ name: products.category });
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
          skintype: products.skinType,
          skinConcern: products.skinConcern,
          howToUse: products.howToUse,
          productImage: images,
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
            .exec();

        const count = await Product.countDocuments(query);

        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        if (category && brand) {
            res.render("admin/product-list", {
                products: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
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

exports.blockProduct = async(req,res)=>{
    try{
        let id = req.params.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect('/admin/product-list')

    }catch(error){
        res.redirect('/admin/admin-error')

    }
}

exports.unblockProduct = async(req,res)=>{
    try{
        let id = req.params.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect('/admin/product-list')
    }catch(error){
        res.redirect('/admin/admin-error')
    }
}

exports.getEditProduct = async(req,res)=>{
    try{
        const id = req.query.id;
        const product = await Product.findOne({_id:id});
        const category = await Category.find({});
        res.render('/admin/edit-product',{
            product:product,
            cat:category
        })
    }catch(error){
        res.redirect('/admin/admin-error')
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
      .exec();

    const count = await Product.countDocuments(query); // Total number of products

    const category = await Category.find({ isListed: true });
    const brand = await Brand.find({ isBlocked: false });

    if (category && brand) {
      res.render("admin/product-list", {
        products: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalProducts: count, // Add totalProducts here
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