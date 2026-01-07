

import Category from '../../models/categorySchema.js';
import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js'; 

export const categoryInfo = async (req, res) => {
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

    res.render('admin/category', {
      layout: 'layouts/adminLayout',
      cat: categoryData,
      currentPage,
      totalPages,
      totalCategories,
      search
    });
  } catch (error) {
    console.error("Category info error:", error);
    res.status(STATUS.INTERNAL_ERROR).render('admin/admin-error', {
      pageTitle: 'Admin Error',
      heading: 'Oops! Something Went Wrong',
      userName: 'Admin',
      imageURL: '/images/admin-avatar.jpg',
      errorMessage: MESSAGES.COMMON.SOMETHING_WENT_WRONG
    });
  }
};

export const addCategory = async (req, res) => {
  const { categoryName, description } = req.body;

  try {
    const existCategory = await Category.findOne({ categoryName });
    if (existCategory) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.CATEGORY_ALREADY_EXISTS || 'Category already exists' 
      });
    }

    const newCategory = new Category({
      categoryName,
      description,
    });

    await newCategory.save();

    return res.status(STATUS.OK).json({ 
      success: true, 
      message: MESSAGES.PRODUCT.CATEGORY_ADDED_SUCCESS || 'Category added successfully' 
    });
  } catch (error) {
    console.error("Add category error:", error);
    return res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};

export const getListCategory = async (req, res) => {
  try {
    const id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: true } });
    res.json({ success: true, isListed: true });
  } catch (error) {
    console.log('Error',error)
    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};

export const getUnlistCategory = async (req, res) => {
  try {
    const id = req.query.id;
    await Category.updateOne({ _id: id }, { $set: { isListed: false } });
    res.json({ success: true, isListed: false });
  } catch (error) {
    console.log('Error',error)
    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};

export const getEditCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const category = await Category.findOne({ _id: id });

    if (!category) {
      return res.status(STATUS.NOT_FOUND).render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'Category Not Found',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        errorMessage: MESSAGES.PRODUCT.NOT_FOUND || 'The requested category was not found.'
      });
    }

    res.render("admin/edit-category", {
      layout: 'layouts/adminLayout',
      category,
      currentPage: 'category'
    });
  } catch (error) {
    console.error('Error in getEditCategory:', error);
    res.redirect('/admin/pageError');
  }
};

export const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryName, description } = req.body;

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { categoryName, description },
      { new: true }
    );

    if (updatedCategory) {
      res.redirect('/admin/category');
    } else {
      res.status(STATUS.NOT_FOUND).render('admin/admin-error', { 
        errorMessage: MESSAGES.PRODUCT.NOT_FOUND 
      });
    }
  } catch (error) {
    console.error('Error in editCategory:', error);
    res.status(STATUS.INTERNAL_ERROR).render('admin/admin-error', { 
      errorMessage: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};

export const addCategoryOffer = async (req, res) => {
  try {
    const { categoryId, offerPercent, startDate, endDate } = req.body;

    if (!categoryId || !offerPercent || !startDate || !endDate) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: MESSAGES.VALIDATION.FIX_ERRORS || 'All fields are required' 
      });
    }

    const offer = Number(offerPercent);
    if (isNaN(offer) || offer < 1 || offer > 99) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: 'Offer must be between 1% and 99%' 
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: 'Invalid date format' 
      });
    }

    if (start >= end) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: 'End date must be after start date' 
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(STATUS.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.NOT_FOUND 
      });
    }

    category.categoryOffer = offer;
    category.offerStart = start;
    category.offerEnd = end;
    category.offerActive = true;

    await category.save();

    res.json({
      success: true,
      message: MESSAGES.PRODUCT.OFFER_ADDED_SUCCESS || 'Offer added successfully',
      offer: {
        percent: offer,
        start: start.toLocaleDateString(),
        end: end.toLocaleDateString()
      }
    });
  } catch (error) {
    console.error('Add category offer error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};

export const removeCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.body;

    if (!categoryId) {
      return res.status(STATUS.BAD_REQUEST).json({ 
        success: false, 
        message: 'Category ID is required' 
      });
    }

    const result = await Category.findByIdAndUpdate(
      categoryId,
      {
        $set: {
          categoryOffer: 0,
          offerStart: null,
          offerEnd: null,
          offerActive: false
        }
      },
      { new: true }
    );

    if (!result) {
      return res.status(STATUS.NOT_FOUND).json({ 
        success: false, 
        message: MESSAGES.PRODUCT.NOT_FOUND 
      });
    }

    res.json({ 
      success: true, 
      message: MESSAGES.PRODUCT.OFFER_REMOVED_SUCCESS || 'Offer removed successfully' 
    });
  } catch (error) {
    console.error('Remove category offer error:', error);
    res.status(STATUS.INTERNAL_ERROR).json({ 
      success: false, 
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG 
    });
  }
};