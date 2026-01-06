

import bcrypt from 'bcrypt';
import Product from '../../models/productSchema.js';
import User from '../../models/userSchema.js';
import Cart from '../../models/cartSchema.js';
import { generateOtp, sendVerificationEmail } from '../../utils/emailService.js';
import * as referralController from '../../controllers/user/referralController.js'; 
import calculatePricing from '../../utils/calculatePricing.js';
import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js';

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw error;
  }
};

export const loadHomePage = async (req, res) => {
  try {
    const productsPerPage = 9;
    const currentPage = parseInt(req.query.page) || 1;
    const totalProducts = await Product.countDocuments({
      isActive: true,
      isBlocked: false,
      status: 'Available'
    });
    const totalPages = Math.ceil(totalProducts / productsPerPage);

    const products = await Product.find({
      isActive: true,
      isBlocked: false,
      status: 'Available',
      quantity: { $gt: 0 }
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('category')
      .lean();

    const productsWithPricing = products.map(product => ({
      ...product,
      pricing: calculatePricing(product)
    }));

    const formattedProducts = productsWithPricing.map(product => ({
      id: product._id.toString(),
      productName: product.productName,
      productImages: product.productImages,
      price: product.salePrice,
      rating: product.rating ?? 4,
      reviews: product.reviews ?? 0,
      pricing: product.pricing
    }));

    let findUserData = null;
    if (req.session.user) {
      findUserData = await User.findById(req.session.user);
    }

    let cartCount = 0;
    if (req.user?._id) {
      const cart = await Cart.findOne({ user: req.user._id }).lean();
      cartCount = cart?.items?.length || 0;
    }

    res.render('user/home', {
      title: 'Beauty Pronounced',
      paginatedProducts: formattedProducts,
      heroImage: 'https://res.cloudinary.com/du0krnsgb/image/upload/v1767/home/hero.jpg',
      user: findUserData,
      cartCount,
       currentPage,
       totalPages
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(STATUS.INTERNAL_ERROR).render('error', {
      message: MESSAGES.HOME.LOAD_FAILED || 'An error occurred while loading the homepage.'
    });
  }
};

export const loadSignup = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect('/user/home');
    }
    res.render('user/signup', { errors: {}, old: {}, message: '' });
  } catch (error) {
    console.error('Signup page error:', error);
    res.status(STATUS.INTERNAL_ERROR).render('user/signup', {
      errors: { general: MESSAGES.COMMON.SERVER_ERROR || 'Server error' },
      old: {},
      message: MESSAGES.COMMON.SERVER_ERROR || 'Server error'
    });
  }
};

export const loadOtp = (req, res) => {
  res.render("user/verify-otp", {
    pageTitle: 'OTP Verification',
    heading: 'OTP Verification',
    description: 'Enter the 4-digit code sent to your phone number',
    buttonText: 'VERIFY OTP',
    formAction: '/verify-otp',
    loginUrl: '/login',
    initialTimer: '00:30',
    backgroundImage: 'https://storage.googleapis.com/a1aa/image/aff8b111-8925-4b75-503a-b5fdc7cbeab9.jpg',
    initialTime: 30,
    resendTimer: 30,
    resendUrl: '/resend-otp'
  });
};

export const pageNotFound = async (req, res) => {
  try {
    return res.render("page-404");
  } catch (error) {
     console.error(error);
    res.redirect("/pageNotFound");
  }
};

export const signup = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword, referralCode } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('user/signup', {
        errors: { email: MESSAGES.AUTH.EMAIL_EXISTS || 'Email already registered' },
        old: req.body,
        message: MESSAGES.AUTH.EMAIL_EXISTS || 'Email already registered'
      });
    }

    if (password !== confirmPassword) {
  return res.status(400).json({ message: 'Passwords do not match' });
}

    if (referralCode) {
      const referrer = await User.findOne({
        referralCode: referralCode.toUpperCase()
      });
      if (!referrer) {
        return res.render('user/signup', {
          errors: { referralCode: MESSAGES.REFERRAL.INVALID || 'Invalid referral code' },
          old: req.body,
          message: MESSAGES.REFERRAL.INVALID || 'Invalid referral code'
        });
      }

      req.session.referralCode = referralCode.toUpperCase();
    }

    const otp = generateOtp();
    console.log('Generated OTP:', otp);
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render('user/signup', {
        errors: { general: MESSAGES.OTP.SEND_FAILED || 'Failed to send verification email' },
        old: req.body,
        message: MESSAGES.OTP.SEND_FAILED || 'Failed to send verification email'
      });
    }

    req.session.userOtp = otp;
    req.session.userData = { email, password, name, phone };

    return res.render('user/verify-otp', {
      message: MESSAGES.OTP.SENT_SUCCESS || 'OTP sent to your email',
      pageTitle: 'OTP Verification',
      heading: 'OTP Verification',
      description: 'Enter the 4-digit code sent to your phone number',
      buttonText: 'VERIFY OTP',
      formAction: '/verify-otp',
      loginUrl: '/login',
      initialTimer: '00:30',
      backgroundImage: 'https://storage.googleapis.com/a1aa/image/aff8b111-8925-4b75-503a-b5fdc7cbeab9.jpg',
      initialTime: 30,
      resendTimer: 30,
      resendUrl: '/resend-otp'
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.render('user/signup', {
      errors: { general: MESSAGES.COMMON.SERVER_ERROR || 'Server error' },
      old: req.body,
      message: MESSAGES.COMMON.SERVER_ERROR || 'Server error'
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;

    if (String(otp) === String(req.session.userOtp)) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      });

      await saveUserData.save();
      req.session.user = saveUserData._id;

      if (req.session.referralCode) {
        await referralController.processReferralSignup(
          saveUserData._id,
          req.session.referralCode
        );
        delete req.session.referralCode;
      }

      delete req.session.userOtp;
      delete req.session.userData;

      res.json({ success: true, redirectUrl: "/" });
    } else {
      res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.OTP.INVALID || "Invalid OTP, try again"
      });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || "An error occurred"
    });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData || {};
    if (!email) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.SESSION.EMAIL_NOT_FOUND || "Email not found in session"
      });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
      console.log("Resend OTP:", otp);
      return res.status(STATUS.OK).json({
        success: true,
        message: MESSAGES.OTP.RESENT_SUCCESS || "OTP resent successfully"
      });
    } else {
      return res.status(STATUS.INTERNAL_ERROR).json({
        success: false,
        message: MESSAGES.OTP.SEND_FAILED || "Failed to resend OTP, Please try again"
      });
    }
  } catch (error) {
    console.error("Error retry sending OTP:", error);
    return res.status(STATUS.INTERNAL_ERROR).json({
      success: false,
      message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || "Internal Server Error, Please try again"
    });
  }
};

export const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render('user/login', {
        pageTitle: 'Login Page',
        bgImage: 'https://storage.googleapis.com/a1aa/image/aff8b111-8925-4b75-503a-b5fdc7cbeab9.jpg'
      });
    } else {
      res.redirect('/');
    }
  } catch (error) {
    console.error("Login page error:", error);
    res.redirect('/pageNotFound');
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ isAdmin: 0, email }).select('+password');

    if (!findUser) {
      return res.render('user/login', {
        message: MESSAGES.AUTH.USER_NOT_FOUND || 'User not found',
        pageTitle: 'Login Page',
        old: req.body
      });
    }

    if (findUser.isBlocked) {
      return res.render('user/login', {
        message: MESSAGES.AUTH.BLOCKED || 'User is blocked by admin',
        pageTitle: 'Login Page',
        old: req.body
      });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render('user/login', {
        message: MESSAGES.AUTH.INCORRECT_PASSWORD || 'Incorrect password',
        pageTitle: 'Login Page',
        old: req.body
      });
    }

    req.session.user = findUser._id;
    console.log('Login successful, session.user set to:', findUser._id);
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('user/login', {
      message: MESSAGES.AUTH.LOGIN_FAILED || 'Login failed, please try again later',
      pageTitle: 'Login Page',
      old: req.body
    });
  }
};

export const logout = async (req, res) => {
  try {
    console.log("Logout reached");

    req.session.destroy(err => {
      if (err) {
        console.log('Session destruction error', err.message);
        return res.redirect('/');
      }

      res.clearCookie('userSessionId');
      return res.redirect('/login');
    });
  } catch (error) {
    console.log('Logout error', error);
    res.redirect('/');
  }
};

