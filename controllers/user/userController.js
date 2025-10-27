
const bcrypt = require('bcrypt') 
const Product = require('../../models/productSchema')
const User = require('../../models/userSchema')

const {generateOtp, sendVerificationEmail } = require('../../utils/emailService')



exports.loadHomePage = async (req, res) => {
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
      quantity:{$gt:0}
    })
      .sort({createdAt:-1})
      .limit(8)
      .populate('category')
      .lean();


    const formattedProducts = products.map(product => ({
      id: product._id.toString(), 
      name: product.productName,
      image: product.productImages?.length > 0 
        ? '/Uploads/product-images/' + product.productImages[0] 
        : 'https://storage.googleapis.com/a1aa/image/placeholder.jpg',
      price: product.salePrice,
      rating: product.rating ?? 4,
      reviews: product.reviews ?? 0
    }));
      console.log(req.session.user)

      let findUserData = null
      if (req.session.user) {
         findUserData = await User.findById(req.session.user)
      }

      
 
    res.render('user/home', {
      title: 'Beauty Pronounced',
      paginatedProducts: formattedProducts,
      user:findUserData
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).render('error', {
      message: 'An error occurred while loading the homepage.'
    });
  }
};

exports.loadSignup = async (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect('user/home');
    }
    res.render('user/signup', { errors: {}, old: {}, message: '' });
  } catch (error) {
    console.error('Signup page error:', error);
    res.status(500).render('user/signup', { errors: { general: 'Server error' }, old: {}, message: 'Server error' });
  }
};

exports.loadOtp = (req, res) => {
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
}

exports.pageNotFound = async (req,res)=>{
    try{
       return res.render("page-404")
    }catch(error){
        res.redirect("/pageNotFound")
    }
}


exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body; 
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('user/signup', {
        errors: { email: 'Email already registered' },
        old: req.body,
        message: 'Email already registered'
      });
    }

    const otp = generateOtp();
    console.log('Generated OTP:', otp);
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render('user/signup', {
        errors: { general: 'Failed to send verification email' },
        old: req.body,
        message: 'Failed to send verification email'
      });
    }

    req.session.userOtp = otp;
    req.session.userData = { email, password, name, phone };

    return res.render('user/verify-otp', {
      message: 'OTP sent to your email',
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
      errors: { general: 'Server error' },
      old: req.body,
      message: 'Server error'
    });
  }
};
 
const securePassword = async(password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch(error) {
    console.error("Error hashing password:", error);
    throw error;
  }
}

exports.verifyOtp = async(req,res)=>{
  try{
    const {otp} = req.body
    console.log("Received OTP:", otp)
    console.log("Session OTP:", req.session.userOtp)
    console.log("OTP comparison:", String(otp), "===", String(req.session.userOtp))

    if(String(otp) === String(req.session.userOtp)){
      const user = req.session.userData
      const passwordHash = await securePassword(user.password)
      
      const saveUserData = new User({
        name: user.name,  
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      })

      await saveUserData.save()
      req.session.user = saveUserData._id;
      

      delete req.session.userOtp;
      delete req.session.userData;
      
      res.json({success:true, redirectUrl:"/"})
    }else{
      res.status(400).json({success:false, message:"Invalid OTP, try again"})
    }
  }catch(error){
    console.error("Error verifying OTP:", error)
    res.status(500).json({success:false, message:"An error occurred"})
  }
}

exports.resendOtp = async(req,res)=>{
  try{
    const {email} = req.session.userData || {};
    if(!email){
      return res.status(400).json({success:false, message:"Email not found in session"})
    }

    const otp = generateOtp()
    req.session.userOtp = otp

    const emailSent = await sendVerificationEmail(email, otp);
    
    if(emailSent){
      console.log("Resend OTP:", otp)
      return res.status(200).json({success:true, message:"OTP resent successfully"})
    }else{
      return res.status(500).json({success:false, message:"Failed to resend OTP, Please try again"})
    }
  }catch(error){
    console.error("Error retry sending OTP:", error)
    return res.status(500).json({success:false, message:"Internal Server Error, Please try again"})
  }
}


exports.loadLogin = async (req, res) => {
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



exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;


    const findUser = await User.findOne({ isAdmin: 0, email }).select('+password');
    
    if (!findUser) {
      return res.render('user/login', {
        message: 'User not found',
        pageTitle: 'Login Page',
        old: req.body 
      });
    }

    if (findUser.isBlocked) {
      return res.render('user/login', {
        message: 'User is blocked by admin',
        pageTitle: 'Login Page',
        old: req.body
      });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);

    if (!passwordMatch) {
      return res.render('user/login', {
        message: 'Incorrect password',
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
      message: 'Login failed, please try again later',
      pageTitle: 'Login Page',
      old: req.body 
    });
  }
};


exports.resendOtp = async (req, res) => {
    try {
        const email = req.session.email;
        if (!email) {
            return res.json({
                success: false,
                message: 'Session expired. Please start the password reset process again.'
            });
        }

        const findUser = await User.findOne({ email });
        if (!findUser) {
            return res.json({
                success: false,
                message: 'User with this email does not exist'
            });
        }

        const otp = generateOtp();
        const emailSent = await exports.sendVerificationEmail(email, otp);

        if (emailSent) {
            req.session.userOtp = otp;
            req.session.otpTimestamp = Date.now();
            res.json({ success: true, message: 'OTP resent successfully. Please check your email.' });
        } else {
            res.json({ success: false, message: 'Failed to resend OTP. Please try again.' });
        }
    } catch (error) {
        console.error('Error resending OTP:', error);
        res.json({ success: false, message: 'Something went wrong. Please try again.' });
    }
};

exports.logout = async(req,res)=>{
  try{

    req.session.destroy((err)=>{
      if(err){
        console.log('session destruction error',err.message)
        return res.redirect('user/pageNotFound')
      }
      return res.redirect('/')
    })

  }catch(error){
    console.log('Logout error',error)
    res.redirect('user/pageNotFound')
  }
}