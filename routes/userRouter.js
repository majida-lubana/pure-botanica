const express = require('express')
const router = express.Router()
const passport = require('passport')
const { isLoggedIn } = require('../middlewares/auth'); 

const userController = require('../controllers/user/userController')
const profileController = require('../controllers/user/profileController')
const shopController = require('../controllers/user/shopController');
const orderController = require('../controllers/user/orderController');
const addressController = require('../controllers/user/addressController')
const cartController = require('../controllers/user/cartController')
const checkoutController = require('../controllers/user/checkoutController')
const forgotPassController = require('../controllers/user/forgotPassController')
const { signupSchema, loginSchema} = require('../validators/authValidators');



const { userAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');

router.get('/',userController.loadHomePage)
router.get('/pageNotFound',userController.pageNotFound)
router.get('/signup',userController.loadSignup)
router.post('/signup',validate(signupSchema, 'user/signup'),userController.signup)
router.get('/verify-otp',userController.loadOtp)
router.post('/verify-otp',userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)

//Forgot password
router.get('/forgot-password', forgotPassController.getForgotPassPage);
router.post('/forgot-password' ,forgotPassController.sendForgotOtp);
router.get('/reset-otp', forgotPassController.loadOtpPage);
router.post('/reset-otp', forgotPassController.forgotVerifyOtp);
router.post('/resend-otp', forgotPassController.forgotResendOtp);
router.get('/reset-password', forgotPassController.loadResetPasswordPage);
router.post('/reset-password', forgotPassController.resetPassword);

router.get('/login',userController.loadLogin)
router.post('/login',validate(loginSchema, 'user/login'),userController.login)
router.get('/logout',userController.logout)

// Google authentication
router.get('/auth/google',
   passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', 
  (req, res, next) => {
    console.log('=== Google Callback Hit ===');
    console.log('Full URL:', req.url);
    console.log('Query params:', req.query);
    console.log('Session ID:', req.sessionID);
    next();
  }, 
  passport.authenticate('google', { failureRedirect: '/signup' }), 
  (req, res) => {
    console.log('=== Auth Successful ===');
    console.log('User object:', req.user);
    console.log('Is authenticated:', req.isAuthenticated());

    if(req.user.isBlocked){
      req.logout(()=>{
        req.session.destroy();
        return res.redirect('/login?blocked=true')
      })
    }else{
      req.session.user = req.user._id
      res.redirect('/');
    }
  }
);

// Profile management
router.get('/profile', userAuth, profileController.loadUserProfile)
router.get('/profile/:id', userAuth, profileController.userProfile)
router.post('/send-emailOtp',userAuth,profileController.sendEmailOtp)
router.post('/verify-email-otp',userAuth,profileController.verifyEmailOtp)
router.post('/resend-emailOtp',userAuth,profileController.resendEmailOtp)
router.post('/update-profile',userAuth, profileController.updateProfile)
router.post('/change-password',userAuth,profileController.updatePassword)

// Address management 
router.get('/address', userAuth, addressController.loadAddress);
router.get('/address/:id', userAuth, addressController.getAddress);
router.post('/address/add', userAuth,addressController.addAddress);
router.put('/address/edit/:id', userAuth, addressController.editAddress);
router.delete('/address/:id', userAuth, addressController.deleteAddress);

// Shop
router.get('/shop', userAuth, shopController.loadShopPage);
router.get('/api/products', shopController.getProductsApi);
router.get('/product/availability/:id', shopController.checkProductAvailability);
router.get('/product/:id',isLoggedIn, shopController.loadProductPage);

// Order management
router.get('/orders', userAuth, orderController.loadOrderPage);
router.get('/order-details/:orderId', userAuth, orderController.getOrderDetailsPage);
router.post('/orders/:orderId/cancel-item', userAuth, orderController.cancelItem);
router.post('/orders/:orderId/return', userAuth, orderController.returnItem);

// Cart management
router.get('/cart', userAuth, cartController.getCartPage);
router.post('/cart/add', userAuth, cartController.addToCart);
router.post('/cart/update', userAuth, cartController.updateCartQuantity);
router.post('/cart/remove', userAuth, cartController.removeFromCart);
router.post('/cart/contents', userAuth, cartController.getCartContents);
router.post('/cart/quantity', userAuth, cartController.getCartQuantity);
router.post('/cart/summary', userAuth, cartController.getCartSummary);
router.post('/cart/check-quantity',userAuth,cartController.checkCartQuantity)

// Checkout management
router.get('/checkout', userAuth, checkoutController.getCheckoutPage);
router.post('/checkout/place-order', userAuth, checkoutController.placeOrder);
router.get('/order-success', userAuth, checkoutController.getOrderSuccessPage);
router.get('/order-error', userAuth, checkoutController.getOrderErrorPage);
router.post('/add-address', userAuth, checkoutController.addAddress);
router.get('/get-address/:addressId', userAuth, checkoutController.getAddress);
router.put('/edit-address/:addressId', userAuth, checkoutController.editAddress);
router.delete('/remove-address/:addressId', userAuth, checkoutController.removeAddress);

module.exports = router