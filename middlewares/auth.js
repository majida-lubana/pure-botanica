const User = require('../models/userSchema');

exports.userAuth = async (req, res, next) => {
  try {
    console.log(`[${req.method} ${req.path}] Session ID:`, req.sessionID);
    console.log(`[${req.method} ${req.path}] Session:`, req.session);
    console.log(`[${req.method} ${req.path}] User in session:`, req.session.user);
    if (!req.session.user) {
      console.log('No user in session');
      if (req.xhr || req.headers.accept.includes('json')) {
        return res.status(401).json({ success: false, message: 'Please login', redirectUrl: '/login' });
      }
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.user);
    if (user && !user.isBlocked) {
      req.user = user;
      console.log(`[${req.method} ${req.path}] User found:`, user._id);
      return next();
    }

    req.session.destroy(() => {
      console.log('User blocked or not found, session destroyed');
      if (req.xhr || req.headers.accept.includes('json')) {
        return res.status(401).json({ success: false, message: 'Please login', redirectUrl: '/login' });
      }
      res.redirect('/login');
    });
  } catch (error) {
    console.error(`[${req.method} ${req.path}] Error in userAuth middleware:`, error);
    if (req.xhr || req.headers.accept.includes('json')) {
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
    res.status(500).send('Internal server error');
  }
}

exports.adminAuth = (req, res, next) => {
  try {
   
    if (req.session.admin === true) {
    
      req.admin = { role: 'admin' };
      return next();
    }

    // not logged in as admin:
    return res.redirect('/admin/login');
  } catch (error) {
    console.error('Error in adminAuth middleware:', error);
    res.redirect('/admin/login');
  }
};

exports.isLoggedIn = (req,res,next)=>{
  if(req.session.user){
    return next()
  }
  res.redirect('/login')
}