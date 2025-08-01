const User = require('../../models/userSchema')
const env = require('dotenv').config()
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt') 



exports.loadHomePage = async (req, res) => {
    try {
        console.log("Session data:", req.session); 
        const userId = req.session.user;
        
        if (userId) {
            console.log("User found in session:", userId); 
            const userData = await User.findOne({_id: userId});
            console.log("User data from DB:", userData);
            
            if (userData) {
                return res.render('user/home', {user: userData}); 
            } else {
                console.log("User not found in database");
                return res.render('user/home'); 
            }
        } else {
            console.log("No user in session");
            return res.render('user/home'); // 
        }
    } catch (error) {
        console.error("Home Page Error:", error); 
        res.status(500).send('Server Error');
    }
}

exports.loadSignup = async(req,res)=>{
    try{
       return res.render("user/signup")
    }catch(error){
        console.log("signup page not found")
        res.status(500).send('Server error')
    }
}

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

function generateOtp(){
  const otp = Math.floor(1000+Math.random()*9000).toString();
  console.log("Generated OTP:", otp);
  return otp;
}

async function sendVerificationEmail(email, otp){
  console.log("Attempting to send email to:", email);
  console.log("Using email credentials:", process.env.NODEMAILER_EMAIL);
  
  try{
    const transporter = nodemailer.createTransport({
      service:'gmail',
      port:587,
      secure:false,
      requireTLS:true,
      auth:{
        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD
      }
    });

    console.log("Transporter created successfully");

    const info = await transporter.sendMail({
      from:process.env.NODEMAILER_EMAIL,
      to:email,
      subject:"verify your account",
      text:`your OTP is ${otp}`,
      html:`<b>Your OTP: ${otp}</b>`,
    });
    
    console.log("Email send result:", info);
    console.log("Accepted:", info.accepted);
    console.log("Rejected:", info.rejected);
    
    return info.accepted && info.accepted.length > 0;
    
  }catch(error){
      console.error("Detailed email error:", error);
      return false;
  }
}

exports.signup = async (req, res) => {
  console.log("Signup request received:", req.body);
  
  const { name, email, phone, password, confirmPassword } = req.body;

  try {
    if(password !== confirmPassword){
      console.log("Password mismatch");
      return res.render("user/signup", {message: "Passwords do not match"});
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("User already exists:", email);
      return res.render("user/signup", {message: "Email already registered"});
    }

    console.log("Generating OTP...");
    const otp = generateOtp();

    console.log("Sending verification email...");
    const emailSent = await sendVerificationEmail(email, otp);
    
    console.log("Email sent result:", emailSent);
    
    if(!emailSent){
      console.log("Email sending failed");
      return res.render("user/signup", {message: "Failed to send verification email"});
    }

    req.session.userOtp = otp;
    // FIXED: Changed fullName to name
    req.session.userData = {email, password, name, phone};

    console.log("OTP stored in session:", otp);
    console.log("Session data:", req.session);

    return res.render("user/verify-otp", {
        message: "OTP sent to your email",
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
    console.error("Signup error:", error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).send(`${field} already exists`);
    }
    
    res.status(500).send("Server error");
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
        name: user.name,  // FIXED: Changed from user.fullName to user.name
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      })

      await saveUserData.save()
      req.session.user = saveUserData._id;
      
      // Clear the OTP and userData from session after successful verification
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
    console.error("Error resending OTP:", error)
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

exports.login = async(req,res)=>{
  try{

    const {email,password} = req.body;
    const findUser = await User.findOne({isAdmin:0,email:email});

    if(!findUser){
      return res.render('user/login',{
          message:"user not found",
          pageTitle:'Login Page'

        })
    }
    if(findUser.isBlocked){
      return res.render('user/login',{
        message:"user is blocked by admin",
        pageTitle:'Login Page'
      })
    }

    const passwordMatch = await bcrypt.compare(password,findUser.password);

    if(!passwordMatch){
      return res.render('user/login',{
        message:"Incorrect Password",
        pageTitle:'Login Page'
      })
    }

    req.session.user = findUser._id;
    res.redirect('/')

  }catch(error){
      console.error("login error",error)
      res.render('user/login',{
        message:"login failed, Please try again later",
        pageTilte:'Login Page'
      })

  }
}

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