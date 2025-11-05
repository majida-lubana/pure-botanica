
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



exports.addCategoryOffer = async (req, res) => {
  try {
    const { categoryId, offerPercent, startDate, endDate } = req.body;


    if (!categoryId || !offerPercent || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const offer = Number(offerPercent);
    if (isNaN(offer) || offer < 1 || offer > 99) {
      return res.status(400).json({ success: false, message: 'Offer must be 1-99%' });
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }

    if (start >= end) {
      return res.status(400).json({ success: false, message: 'End date must be after start date' });
    }


    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    category.categoryOffer = offer;
    category.offerStart    = start;
    category.offerEnd      = end;
    category.offerActive   = true;         

    await category.save();

   
    res.json({
      success: true,
      message: 'Offer added successfully',
      offer: {
        percent: offer,
        start:   start.toLocaleDateString(),
        end:     end.toLocaleDateString()
      }
    });

  } catch (error) {
    console.error('Add category offer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.removeCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.body;

    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Category ID required' });
    }

    const result = await Category.findByIdAndUpdate(
      categoryId,
      {
        $set: {
          categoryOffer: 0,
          offerStart:    null,
          offerEnd:      null,
          offerActive:   false
        }
      },
      { new: true, runValidators: true }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.json({ success: true, message: 'Offer removed successfully' });

  } catch (error) {
    console.error('Remove category offer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};