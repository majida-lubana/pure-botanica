// routes/adminRouter.js

import express from 'express';
const router = express.Router();

import { adminAuth } from '../middlewares/auth.js';
import uploads from '../utils/multer.js';


// Named imports from EACH controller
import {
  loadLogin,
  pageError,
  login,
  logout
} from '../controllers/admin/adminController.js'; // ← Renamed from adminController

import {
  customerInfo,
  customerBlocked,
  customerUnblocked
} from '../controllers/admin/customerController.js';

import {
  categoryInfo,
  addCategory,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory,
  addCategoryOffer,
  removeCategoryOffer
} from '../controllers/admin/categoryController.js';

import {
  getproductAddPage,
  addProducts,
  getAllproducts,
  blockProduct,
  unblockProduct,
  getEditProduct,
  updateProduct,
  addProductOffer,
  removeProductOffer
} from '../controllers/admin/productController.js';

import {
  renderOrderManage,
  renderOrderDetails,
  getOrderById,
  updateOrderStatus,
  verifyReturn
} from '../controllers/admin/orderController.js';

import {
  getCouponPage,
  addCoupon,
  getCouponById,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon
} from '../controllers/admin/couponController.js';

import {
  loadSalesReport,
  downloadSalesReport
} from '../controllers/admin/dashboardController.js';

// Routes
router.get('/admin-error', pageError);

router.get('/login', loadLogin);
router.post('/login', login);
router.get('/logout', logout);

// Customer management
router.get('/users', adminAuth, customerInfo);
router.post('/block/:id', adminAuth, customerBlocked);
router.post('/unblock/:id', adminAuth, customerUnblocked);

// Category management 
router.get('/category', adminAuth, categoryInfo);
router.post('/addCategory', adminAuth, addCategory);
router.put('/listCategory', adminAuth, getListCategory);
router.put('/unListCategory', adminAuth, getUnlistCategory);
router.get('/edit-category/:id', adminAuth, getEditCategory);
router.post('/edit-category/:id', adminAuth, editCategory);
router.post('/addCategoryOffer', adminAuth, addCategoryOffer);
router.post('/removeCategoryOffer', adminAuth, removeCategoryOffer);

// Product management
router.get('/add-product', adminAuth, getproductAddPage);
router.post('/add-product', adminAuth, uploads.array("images", 4), addProducts);
router.get('/product-list', adminAuth, getAllproducts);
router.put('/blockProduct/:id', adminAuth, blockProduct);
router.put('/unblockProduct/:id', adminAuth, unblockProduct);
router.get('/edit-product/:id', adminAuth, getEditProduct);
router.post('/update-product/:id', adminAuth, uploads.array("images", 4), updateProduct);
router.put('/add-product-offer/:id', adminAuth, addProductOffer);
router.put('/remove-product-offer/:id', adminAuth, removeProductOffer);

// Order management
router.get("/orders", adminAuth, renderOrderManage);
router.get("/order/details/:orderId", adminAuth, renderOrderDetails);
router.get("/order/orderId", adminAuth, getOrderById);
router.post('/order/update-status/:orderId', adminAuth, updateOrderStatus);        
router.post('/order/verify-return/:orderId', adminAuth, verifyReturn);

// Coupon management
router.get('/coupons', adminAuth, getCouponPage);
router.post('/coupon/add', adminAuth, addCoupon);
router.get('/coupon/:id', adminAuth, getCouponById);
router.put('/coupon/:id', adminAuth, updateCoupon);
router.put('/coupon/toggle/:id', adminAuth, toggleCouponStatus);
router.delete('/coupon/:id', adminAuth, deleteCoupon);

// Dashboard / Sales Report
router.get('/dashboard', adminAuth, loadSalesReport);
router.get('/dashboard/download', adminAuth, downloadSalesReport);

export default router;