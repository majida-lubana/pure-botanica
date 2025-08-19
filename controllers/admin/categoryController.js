const { name } = require('ejs');
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const mongoose = require('mongoose')


exports.categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4; // Number of categories per page
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';

    // Build query: include all categories (listed or unlisted) for admin view
    const query = search
      ? { categoryName: { $regex: search, $options: 'i' } } // Case-insensitive search
      : {};

    // Fetch categories
    const categoryData = await Category.find(query)
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit);

    // Count total categories for pagination
    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit) || 1; // Ensure at least 1 page
    const currentPage = Math.min(page, totalPages);

    console.log("Query:", query);
    console.log("Total categories:", totalCategories);
    console.log("Categories on page:", categoryData.length);
    console.log("Current page:", currentPage, "Total pages:", totalPages);

    res.render('admin/category', {
      cat: categoryData,
      currentPage,
      totalPages,
      totalCategories,
      search,
      csrfToken: req.csrfToken ? req.csrfToken() : null // Pass CSRF token if used
    });
  } catch (error) {
    console.error("Category info error:", error);
    res.status(500).render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Oops! Something Went Wrong',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      errorMessage: 'Failed to load categories: ' + error.message
    });
  }
};



exports.addCategory = async (req, res) => {
  console.log("Form data:", req.body);
  const { categoryName, description } = req.body;

  try {
    const existCategory = await Category.findOne({ categoryName:categoryName});
    if (existCategory) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    const newCategory = new Category({
      categoryName:categoryName,
      description,
    });

    console.log("New category object created:", newCategory);
    await newCategory.save();
    console.log("Saved category:", newCategory);
    return res.status(200).json({ message: 'Category added successfully' });
  } catch (error) {
    console.error("Add category error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


exports.addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    const products = await Product.find({ category: category._id });

    const hasProductOffer = products.some((p) => p.productOffer > percentage);
    if (hasProductOffer) {
      return res.json({
        status: false,
        message: "Some products already have a higher product offer",
      });
    }

    await Category.updateOne(
      { _id: categoryId },
      {
        $set: {
          categoryOffer: percentage,
          offerActive: true,
        },
      }
    );

    for (const p of products) {
      p.productOffer = 0;
      p.salesPrice = p.regularPrice - (percentage / 100) * p.regularPrice;
      await p.save();
    }

    return res.json({ status: true, message: "Category offer applied" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};



exports.removeCategoryOffer = async(req,res) =>{
    try{
        const categoryId = req.body.categoryId
        const category = await Category.findById(categoryId)

        if(!category){
            return res.status(404).json({status:false,message:"Category Not found"})
        }

        console.log("Before removal:", category.categoryOffer);
        const percentage = category.categoryOffer;
        const products = await Product.find({category:category._id});


        if(products.length>0){
            console.log(`Resetting offer for: ${product.productName}`);
            for(const product of products){
                product.salesPrice = product.regularPrice
                product.productOffer = 0
                await product.save()
            }
        }
        console.log("Before:", category.categoryOffer);
        category.categoryOffer = 0
        await category.save()
        console.log("After:", category.categoryOffer);
        res.json({status:true});
    }catch(error){
        res.status(500).json({status:false,message:"internal server error"})
    }
}

exports.getListCategory = async(req,res)=>{
    try{
        let id = req.query.id;
        await Category.updateOne({_id:id},{$set:{isListed:false}})
        res.json({ success: true, isListed: true });
    }catch(error){
        res.status(500).json({ success: false, message: error.message });
    }
}

exports.getUnlistCategory = async(req,res)=>{
    try{
        let id = req.query.id ;
        await Category.updateOne({_id:id},{$set:{isListed:true}})
        res.json({ success: true, isListed: false });
    }catch(error){
       res.status(500).json({ success: false, message: error.message });
    }
}


exports.getEditCategory = async (req, res) => {
    try {
        const id = req.params.id; 
        const category = await Category.findOne({ _id: id });
        if (!category) {
            return res.status(404).render('admin/admin-error', {
                pageTitle: 'Admin Error',
                heading: 'Category Not Found',
                userName: 'Admin',
                imageURL: '/images/admin-avatar.jpg',
                errorMessage: 'The requested category was not found.',
            });
        }
        res.render("admin/edit-category", {
            category,
            currentPage: 'category'
        });
    } catch (error) {
        console.error('Error in getEditCategory:', error);
        res.redirect('/admin/pageError');
    }
};

exports.getEditCategory = async (req, res) => {
    try {
        const id = req.params.id; 
        const category = await Category.findOne({ _id: id });
        if (!category) {
            return res.status(404).render('admin/admin-error', {
                pageTitle: 'Admin Error',
                heading: 'Category Not Found',
                userName: 'Admin',
                imageURL: '/images/admin-avatar.jpg',
                errorMessage: 'The requested category was not found.',
            });
        }
        res.render("admin/edit-category", {
            category,
            currentPage: 'category'
        });
    } catch (error) {
        console.error('Error in getEditCategory:', error);
        res.redirect('/admin/pageError');
    }
};



exports.editCategory = async (req, res) => {
    console.log("Received ID:", req.params.id); 
    console.log("Received Data:", req.body);    

    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        const updatedCategory = await Category.findByIdAndUpdate(id, {
            categoryName,
            description: description
        }, { new: true });

        if (updatedCategory) {
            console.log("Category Updated Successfully:", updatedCategory); 
            res.redirect('/admin/category');
        } else {
            console.log("Category Not Found"); 
            res.status(404).render('pageerror', { message: 'Category not found' });
        }
    } catch (error) {
        console.error('Error in editCategory:', error);
        res.status(500).render('pageerror', { message: 'Internal server error' });
    }
};
