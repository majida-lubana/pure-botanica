const express = require('express')
const router = express.Router()
const passport = require('passport')
const userController = require('../controllers/user/userController')




router.get('/',userController.loadHomePage)
router.get('/pageNotFound',userController.pageNotFound)
router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.get('/verify-otp',userController.loadOtp)
router.post('/verify-otp',userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)

router.get('/login',userController.loadLogin)
router.post('/login',userController.login)
router.get('/logout',userController.logout)

router.get('/auth/google',
   passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/google/callback', (req, res, next) => {
    console.log('=== Google Callback Hit ===');
    console.log('Full URL:', req.url);
    console.log('Query params:', req.query);
    console.log('Session ID:', req.sessionID);
    next();
}, passport.authenticate('google', { 
    failureRedirect: '/signup'
}), (req, res) => {
    console.log('=== Auth Successful ===');
    console.log('User object:', req.user);
    console.log('Is authenticated:', req.isAuthenticated());
    res.redirect('/');
});

module.exports = router