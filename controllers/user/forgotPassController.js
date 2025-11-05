
const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const { generateOtp, sendVerificationEmail } = require('../../utils/emailService');

exports.getForgotPassPage = async (req, res) => {
    try {
        res.render('user/forgot-password', { error: null, message: null });
    } catch (error) {
        console.error('Error rendering forgot password page:', error.message);
        res.redirect('/');
    }
};

exports.loadOtpPage = async (req, res) => {
    try {
        if (!req.session.forgotEmail || !req.session.forgotOtp) {
            return res.redirect('/forgot-password');
        }
        res.render('user/reset-otp', { error: null });
    } catch (error) {
        console.error('Error rendering OTP page:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

exports.sendForgotOtp = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('user/forgot-password', { error: 'User not found', message: null });
        }

        const otp = generateOtp();
        const sent = await sendVerificationEmail(email, otp);

        if (!sent) {
            return res.render('user/forgot-password', { error: 'Failed to send OTP', message: null });
        }

        req.session.forgotOtp = otp;
        req.session.forgotEmail = email;
        req.session.otpTimestamp = Date.now(); 

        console.log('Forgot Password OTP for', email, 'is:', otp);
        res.redirect('/reset-otp');
    } catch (error) {
        console.error('Send forgot OTP error:', error);
        res.render('user/forgot-password', { error: 'Something went wrong', message: null });
    }
};

exports.forgotVerifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.forgotOtp;
        const otpTimestamp = req.session.otpTimestamp;

        
        if (!otpTimestamp || Date.now() - otpTimestamp > 300000) {
            return res.status(400).json({ success: false, message: 'OTP has expired' });
        }

        if (String(otp) === String(sessionOtp)) {
            req.session.otpVerified = true;
            delete req.session.forgotOtp; 
            delete req.session.otpTimestamp;

            res.json({ success: true, redirectUrl: '/reset-password' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid OTP, try again' });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ success: false, message: 'An error occurred' });
    }
};


exports.forgotResendOtp = async (req, res) => {
    try {
        console.log("ethitund")
        const { email } = req.session.forgotEmail ? { email: req.session.forgotEmail } : {};
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email not found in session' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        const newOtp = generateOtp(); 
        req.session.otp = newOtp;
        req.session.forgotEmail = email;
        req.session.forgotOtp = newOtp;
        req.session.otpTimestamp = Date.now();

        await req.session.save();

        const emailSent = await sendVerificationEmail(email, newOtp);

        if (emailSent) {
            console.log('Resend OTP:', newOtp);
            return res.status(200).json({ success: true, message: 'OTP resent successfully' });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send email' });
        }
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

exports.loadResetPasswordPage = async (req, res) => {
    try {
        if (!req.session.otpVerified || !req.session.forgotEmail) {
            return res.redirect('/forgot-password');
        }
        res.render('user/reset-password', { error: null });
    } catch (error) {
        console.error('Error rendering reset password page:', error.message);
        res.redirect('/forgot-password');
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { password, confirmPassword } = req.body;
        const email = req.session.forgotEmail;

        if (!req.session.otpVerified || !email) {
            return res.redirect('/forgot-password');
        }

        if (!password || !confirmPassword) {
            return res.render('user/reset-password', { error: 'Both fields are required' });
        }

        if (password !== confirmPassword) {
            return res.render('user/reset-password', { error: 'Passwords do not match' });
        }

        if (password.length < 8) {
            return res.render('user/reset-password', { error: 'Password must be at least 8 characters long' });
        }

        
        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordPattern.test(password)) {
            return res.render('user/reset-password', {
                error: 'Password must include uppercase, lowercase, number, and special character'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.findOneAndUpdate(
            { email },
            { password: hashedPassword },
            { new: true }
        );

        if (!user) {
            return res.render('user/reset-password', { error: 'User not found' });
        }

        
        req.session.forgotEmail = null;
        req.session.otpVerified = null;

        res.redirect('/login?reset=success');
    } catch (error) {
        console.error('Reset password error:', error);
        res.render('user/reset-password', { error: 'Something went wrong. Try again.' });
    }
};