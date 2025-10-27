const express = require('express')
const router = express.Router();
const adminController = require('../controllers/admin/adminController')
const {userAuth,adminAuth} = require('../middlewares/auth')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const orderController = require('../controllers/admin/orderController')

const uploads = require('../utils/multer');
const path = require('path')

router.get('/admin-error',adminController.pageError)

router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout)
//customer managent
router.get('/users',adminAuth,customerController.customerInfo)
router.post('/block/:id',adminAuth,customerController.customerBlocked)
router.post('/unblock/:id',adminAuth,customerController.customerUnblocked)

//category management
router.get('/category',adminAuth,categoryController.categoryInfo)
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.put('/listCategory',adminAuth,categoryController.getListCategory);
router.put('/unListCategory',adminAuth,categoryController.getUnlistCategory)


router.get('/edit-category/:id',adminAuth,categoryController.getEditCategory)
router.post('/edit-category/:id',adminAuth,categoryController.editCategory)

//Product management
router.get('/add-product',adminAuth,productController.getproductAddPage);
router.post('/add-product',adminAuth,uploads.array("images",4),productController.addProducts)
router.get('/product-list',adminAuth,productController.getAllproducts)
router.put('/blockProduct/:id',adminAuth,productController.blockProduct)
router.put('/unblockProduct/:id',adminAuth,productController.unblockProduct)
router.get('/edit-product/:id',adminAuth,productController.getEditProduct)
router.post('/update-product/:id',adminAuth,uploads.array("images",4),productController.updateProduct)


router.get("/orders",  orderController.renderOrderManage);
router.get("/order/details/:orderId", orderController.renderOrderDetails); 
router.get("/order/orderId", orderController.getOrderById); 
router.post('/order/update-status/:orderId', orderController.updateOrderStatus);
// router.post('/order/update-all-items/:orderId', orderController.updateAllItemsStatus);
router.post('/order/verify-return/:orderId', orderController.verifyReturn);



module.exports = router