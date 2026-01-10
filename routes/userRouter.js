// routes/userRouter.js

import express from 'express';
const router = express.Router();

import passport from 'passport';
import { isLoggedIn, isCheckAuth, userAuth } from '../middlewares/auth.js';
import validate from '../middlewares/validate.js';

// Named imports from each controller
import {
  loadHomePage,
  pageNotFound,
  loadSignup,
  signup,
  loadOtp,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout
} from '../controllers/user/userController.js';

import {
  loadUserProfile,
  userProfile,
  sendEmailOtp,
  verifyEmailOtp,
  resendEmailOtp,
  updateProfile,
  updatePassword
} from '../controllers/user/profileController.js';

import {
  loadShopPage,
  getProductsApi,
  checkProductAvailability,
  loadProductPage
} from '../controllers/user/shopController.js';

import {
  loadOrderPage,
  getOrderDetailsPage,
  cancelItem,
  returnItem
} from '../controllers/user/orderController.js';

import {
  loadAddress,
  getAddress,
  addAddress,
  editAddress,
  deleteAddress
} from '../controllers/user/addressController.js';

import {
  getCartPage,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  getCartContents,
  getCartQuantity,
  getCartSummary,
  getCountInCart
} from '../controllers/user/cartController.js';

import {
  getCheckoutPage,
  placeOrder,
  verifyRazorpayPayment,
  retryPayment,
  handlePaymentFailure,
  getOrderSuccessPage,
  getOrderErrorPage
} from '../controllers/user/checkoutController.js';

import {
  getForgotPassPage,
  sendForgotOtp,
  loadOtpPage,
  forgotVerifyOtp,
  forgotResendOtp,
  loadResetPasswordPage,
  resetPassword
} from '../controllers/user/forgotPassController.js';

import {
  getWallet,
  toggleDefault
} from '../controllers/user/walletController.js';

import {
  getWishlist,
  toggleWishlist,
  removeFromWishList,
  getWishListCount,
  clearWishList
} from '../controllers/user/wishlistController.js';

import {
  getCouponsPage,
  applyCoupon,
  getAvailableCoupons
} from '../controllers/user/couponController.js';

import {
  getReferralPage
} from '../controllers/user/referralController.js';

import { signupSchema, loginSchema } from '../validators/authValidators.js';

// Home & Auth
router.get('/', loadHomePage);
router.get('/pageNotFound', pageNotFound);

router.get('/signup', isCheckAuth, loadSignup);
router.post('/signup', validate(signupSchema, 'user/signup'), signup);

router.get('/getVerify-otp', loadOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resendSignUp-otp', resendOtp);

// Forgot Password
router.get('/forgot-password', getForgotPassPage);
router.post('/forgot-password', sendForgotOtp);
router.get('/reset-otp', loadOtpPage);
router.post('/reset-otp', forgotVerifyOtp);
router.post('/resendForgotPassword-otp', forgotResendOtp);
router.get('/reset-password', loadResetPasswordPage);
router.post('/reset-password', resetPassword);

// Login & Logout
router.get('/login', isCheckAuth, loadLogin);
router.post('/login', validate(loginSchema, 'user/login'), login);

router.get('/logout', (req, res) => res.redirect('/'));
router.post('/logout', userAuth, logout);

// Google Authentication
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/signup' }),
  (req, res) => {
    if (req.user.isBlocked) {
      req.logout(() => {
        req.session.destroy();
        return res.redirect('/login?blocked=true');
      });
    } else {
      req.session.user = req.user._id;
      req.session.save(() => res.redirect('/'));
    }
  }
);

// Profile Management
router.get('/profile', userAuth, loadUserProfile);
router.get('/profile/:id', userAuth, userProfile);
router.post('/send-emailOtp', userAuth, sendEmailOtp);
router.post('/verify-email-otp', userAuth, verifyEmailOtp);
router.post('/resend-emailOtp', userAuth, resendEmailOtp);
router.post('/update-profile', userAuth, updateProfile);
router.post('/change-password', userAuth, updatePassword);

// Address Management
router.get('/address', userAuth, loadAddress);
router.get('/address/:id', userAuth, getAddress);
router.post('/address/add', userAuth, addAddress);
router.put('/address/edit/:id', userAuth, editAddress);
router.delete('/address/:id', userAuth, deleteAddress);

// Shop
router.get('/shop', loadShopPage);
router.get('/api/products', isLoggedIn, getProductsApi);
router.get('/product/availability/:id', checkProductAvailability);
router.get('/product/:id', loadProductPage);

// Cart Management
router.get('/cart', getCartPage);
router.post('/cart/add',  addToCart);
router.post('/cart/update', userAuth, updateCartQuantity);
router.post('/cart/remove', userAuth, removeFromCart);
router.post('/cart/contents', userAuth, getCartContents);
router.post('/cart/quantity', userAuth, getCartQuantity);
router.post('/cart/summary', userAuth, getCartSummary);
router.post('/cart/check-quantity', userAuth, getCountInCart);

// Checkout Management
router.get('/checkout', userAuth, getCheckoutPage);
router.post('/checkout/place-order', userAuth, placeOrder);
router.post('/checkout/verify-razorpay', userAuth, verifyRazorpayPayment);
router.post('/checkout/retry-payment/:orderId', userAuth, retryPayment);
router.post('/checkout/handle-payment-failure', userAuth, handlePaymentFailure);
router.get('/order-success', userAuth, getOrderSuccessPage);
router.get('/order-error', userAuth, getOrderErrorPage);

// Order Management
router.get('/orders', userAuth, loadOrderPage);
router.get('/order-details/:orderId', userAuth, getOrderDetailsPage);
router.post('/orders/:orderId/cancel-item', userAuth, cancelItem);
router.post('/orders/:orderId/return', userAuth, returnItem);

// Wallet Management
router.get('/wallet', userAuth, getWallet);
router.post('/wallet/toggle-default', userAuth, toggleDefault);

// Wishlist
router.get('/wishlist', userAuth, getWishlist);
router.post('/wishlist/toggle', userAuth, toggleWishlist);
router.post('/wishlist/remove', userAuth, removeFromWishList);
router.get('/wishlist/count', userAuth, getWishListCount);
router.post('/wishlist/clear', userAuth, clearWishList);

// Coupon Management
router.get('/coupons', userAuth, getCouponsPage);
router.post('/apply-coupon', userAuth, applyCoupon);
router.get('/available-coupons', userAuth, getAvailableCoupons);

// Referral
router.get('/referral', userAuth, getReferralPage);

export default router;