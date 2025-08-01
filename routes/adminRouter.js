const express = require('express')
const router = express.Router();
const adminController = require('../controllers/admin/adminController')
const {userAuth,adminAuth} = require('../middlewares/auth')
const customerController = require('../controllers/admin/customerController')


router.get('/pageError',adminController.pageError)

router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout)
//customer managent
router.get('/users',adminAuth,customerController.customerInfo)
router.get('/block/:id',adminAuth,customerController.customerBlocked)
router.get('/unblock/:id',adminAuth,customerController.customerUnblocked)



module.exports = router