const express = require('express')
const router = express.Router()
const passport = require('passport')
const { isLoggedIn ,isCheckAuth} = require('../middlewares/auth');

const userController = require('../controllers/user/userController')
const profileController = require('../controllers/user/profileController')
const shopController = require('../controllers/user/shopController');
const orderController = require('../controllers/user/orderController');
const addressController = require('../controllers/user/addressController')
const cartController = require('../controllers/user/cartController')
const checkoutController = require('../controllers/user/checkoutController')
const forgotPassController = require('../controllers/user/forgotPassController')        
const { signupSchema, loginSchema} = require('../validators/authValidators');
const walletController = require('../controllers/user/walletController')
const wishlistController = require('../controllers/user/wishlistController')
const couponController = require('../controllers/user/couponController')
const referralController = require('../controllers/user/referralController')



const { userAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');

router.get('/',userController.loadHomePage)
router.get('/pageNotFound',userController.pageNotFound)
router.get('/signup',isCheckAuth,userController.loadSignup)
router.post('/signup',validate(signupSchema, 'user/signup'),userController.signup)      
router.get('/getVerify-otp',userController.loadOtp)
router.post('/verify-otp',userController.verifyOtp)
router.post("/resendSignUp-otp",userController.resendOtp)

//Forgot password
router.get('/forgot-password', forgotPassController.getForgotPassPage);
router.post('/forgot-password' ,forgotPassController.sendForgotOtp);
router.get('/reset-otp', forgotPassController.loadOtpPage);
router.post('/reset-otp', forgotPassController.forgotVerifyOtp);
router.post('/resendForgotPassword-otp', forgotPassController.forgotResendOtp);
router.get('/reset-password', forgotPassController.loadResetPasswordPage);
router.post('/reset-password', forgotPassController.resetPassword);

router.get('/login',isCheckAuth,userController.loadLogin)
router.post('/login',validate(loginSchema, 'user/login'),userController.login)

router.get('/logout', (req, res) => {
  res.redirect('/'); 
});


router.post('/logout', userAuth, userController.logout);


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
      req.session.save(()=>{
          res.redirect('/');
      })
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
router.get('/shop', isLoggedIn, shopController.loadShopPage);
router.get('/api/products',isLoggedIn, shopController.getProductsApi);
router.get('/product/availability/:id', shopController.checkProductAvailability);       
router.get('/product/:id',isLoggedIn, shopController.loadProductPage);

// Cart management
router.get('/cart', userAuth, cartController.getCartPage);
router.post('/cart/add', userAuth, cartController.addToCart);
router.post('/cart/update', userAuth, cartController.updateCartQuantity);
router.post('/cart/remove', userAuth, cartController.removeFromCart);
router.post('/cart/contents', userAuth, cartController.getCartContents);
router.post('/cart/quantity', userAuth, cartController.getCartQuantity);
router.post('/cart/summary', userAuth, cartController.getCartSummary);
router.post('/cart/check-quantity',userAuth,cartController.getCountInCart)

// Checkout management
router.get('/checkout', userAuth, checkoutController.getCheckoutPage);
router.post('/checkout/place-order', userAuth, checkoutController.placeOrder);
router.post('/checkout/verify-razorpay',userAuth,checkoutController.verifyRazorpayPayment)
router.post('/checkout/retry-payment/:orderId', userAuth, checkoutController.retryPayment);
router.post('/checkout/handle-payment-failure', userAuth, checkoutController.handlePaymentFailure);
router.get('/order-success', userAuth, checkoutController.getOrderSuccessPage);
router.get('/order-error', userAuth, checkoutController.getOrderErrorPage);
router.post('/add-address', userAuth, checkoutController.addAddress);
router.get('/get-address/:addressId', userAuth, checkoutController.getAddress);
router.put('/edit-address/:addressId', userAuth, checkoutController.editAddress);       
router.delete('/remove-address/:addressId', userAuth, checkoutController.removeAddress);

// Order management
router.get('/orders', userAuth, orderController.loadOrderPage);
router.get('/order-details/:orderId', userAuth, orderController.getOrderDetailsPage);   
router.post('/orders/:orderId/cancel-item', userAuth, orderController.cancelItem);      
router.post('/orders/:orderId/return', userAuth, orderController.returnItem);

//wallet management
router.get('/wallet', userAuth, walletController.getWallet);
router.post('/wallet/toggle-default', userAuth, walletController.toggleDefault);

//Wishlist
router.get('/wishlist',userAuth,wishlistController.getWishlist)
router.post('/wishlist/toggle',userAuth,wishlistController.toggleWishlist)
router.post('/wishlist/remove',userAuth,wishlistController.removeFromWishList)
router.get('/wishlist/count', userAuth, wishlistController.getWishListCount);
router.post('/wishlist/clear', userAuth, wishlistController.clearWishList);

//coupon Management
router.get('/coupons', userAuth, couponController.getCouponsPage);
router.post('/apply-coupon',userAuth,couponController.applyCoupon)
router.get('/available-coupons', userAuth, couponController.getAvailableCoupons);

router.get('/referral', userAuth, referralController.getReferralPage);

module.exports = router