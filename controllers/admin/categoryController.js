// const { name } = require('ejs');
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const mongoose = require('mongoose')


exports.categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';


    const query = search
      ? { categoryName: { $regex: search, $options: 'i' } }
      : {};

    const categoryData = await Category.find(query)
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limit);

   
    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit) || 1;
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
      search
     
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







exports.getListCategory = async(req,res)=>{
    try{
        let id = req.query.id;

        await Category.updateOne({_id:id},{$set:{isListed:true}})
        res.json({ success: true, isListed: true });
    }catch(error){
        res.status(500).json({ success: false, message: error.message });
    }
}

exports.getUnlistCategory = async(req,res)=>{
    try{
        let id = req.query.id ;
        await Category.updateOne({_id:id},{$set:{isListed:false}})
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
