

import User from '../models/userSchema.js';
import STATUS from '../constants/statusCode.js';
import MESSAGES from '../constants/messages.js';

export const userAuth = async (req, res, next) => {
  try {
    if (!req.session.user) {
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(STATUS.UNAUTHORIZED).json({
          success: false,
          message: MESSAGES.AUTH.REQUIRED_LOGIN || 'Please login',
          redirectUrl: '/login'
        });
      }
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.user);

    if (user && !user.isBlocked) {
      req.user = user;
      return next();
    }

   
    req.session.destroy(() => {
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(STATUS.UNAUTHORIZED).json({
          success: false,
          message: MESSAGES.AUTH.BLOCKED_OR_INVALID || 'Please login',
          redirectUrl: '/login'
        });
      }
      res.redirect('/login');
    });
  } catch (error) {
    console.error('userAuth middleware error:', error);
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(STATUS.INTERNAL_ERROR).json({
        success: false,
        message: MESSAGES.COMMON.SERVER_ERROR || 'Internal server error'
      });
    }
    res.status(STATUS.INTERNAL_ERROR).send('Internal server error');
  }
};

export const adminAuth = (req, res, next) => {
  try {
    if (req.session.admin === true) {
      req.admin = { role: 'admin' };
      return next();
    }

    return res.redirect('/admin/login');
  } catch (error) {
    console.error('adminAuth middleware error:', error);
    res.redirect('/admin/login');
  }
};

export const isLoggedIn = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
};

export const isCheckAuth = (req, res, next) => {
  if (req.session.user) {
    console.log("isCheckAuth: User already logged in");
    console.log("Session user ID:", req.session.user);
    return res.redirect('/');
  }

  next();
};