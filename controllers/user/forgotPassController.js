const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const { generateOtp, sendVerificationEmail } = require('../../utils/emailService');
const STATUS = require('../../constants/statusCode');
const MESSAGES = require('../../constants/messages'); // Centralized messages

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
        res.status(STATUS.INTERNAL_ERROR).render('user/page-404', {
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Internal Server Error',
            pageTitle: 'Error'
        });
    }
};

exports.sendForgotOtp = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('user/forgot-password', {
                error: MESSAGES.AUTH.USER_NOT_FOUND || 'User not found',
                message: null
            });
        }

        const otp = generateOtp();
        const sent = await sendVerificationEmail(email, otp);

        if (!sent) {
            return res.render('user/forgot-password', {
                error: MESSAGES.OTP.SEND_FAILED || 'Failed to send OTP',
                message: null
            });
        }

        req.session.forgotOtp = otp;
        req.session.forgotEmail = email;
        req.session.otpTimestamp = Date.now();

        console.log('Forgot Password OTP for', email, 'is:', otp);
        res.redirect('/reset-otp');
    } catch (error) {
        console.error('Send forgot OTP error:', error);
        res.render('user/forgot-password', {
            error: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Something went wrong',
            message: null
        });
    }
};

exports.forgotVerifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.forgotOtp;
        const otpTimestamp = req.session.otpTimestamp;

        if (!otpTimestamp || Date.now() - otpTimestamp > 300000) { // 5 minutes
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.OTP.EXPIRED || 'OTP has expired'
            });
        }

        if (String(otp) === String(sessionOtp)) {
            req.session.otpVerified = true;
            delete req.session.forgotOtp;
            delete req.session.otpTimestamp;

            res.json({ success: true, redirectUrl: '/reset-password' });
        } else {
            res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.OTP.INVALID || 'Invalid OTP, try again'
            });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'An error occurred'
        });
    }
};

exports.forgotResendOtp = async (req, res) => {
    try {
        const email = req.session.forgotEmail;

        if (!email) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.SESSION.EMAIL_NOT_FOUND || 'Email not found in session'
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.AUTH.USER_NOT_FOUND || 'User not found'
            });
        }

        const newOtp = generateOtp();
        req.session.forgotOtp = newOtp;
        req.session.forgotEmail = email;
        req.session.otpTimestamp = Date.now();

        await req.session.save();

        const emailSent = await sendVerificationEmail(email, newOtp);

        if (emailSent) {
            console.log('Resend OTP:', newOtp);
            return res.status(STATUS.OK).json({
                success: true,
                message: MESSAGES.OTP.RESENT_SUCCESS || 'OTP resent successfully'
            });
        } else {
            return res.status(STATUS.INTERNAL_ERROR).json({
                success: false,
                message: MESSAGES.OTP.SEND_FAILED || 'Failed to send email'
            });
        }
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Internal Server Error'
        });
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
            return res.render('user/reset-password', {
                error: MESSAGES.VALIDATION.REQUIRED_FIELDS || 'Both fields are required'
            });
        }

        if (password !== confirmPassword) {
            return res.render('user/reset-password', {
                error: MESSAGES.PASSWORD.MISMATCH || 'Passwords do not match'
            });
        }

        if (password.length < 8) {
            return res.render('user/reset-password', {
                error: MESSAGES.PASSWORD.TOO_SHORT || 'Password must be at least 8 characters long'
            });
        }

        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordPattern.test(password)) {
            return res.render('user/reset-password', {
                error: MESSAGES.PASSWORD.INVALID_FORMAT || 'Password must include uppercase, lowercase, number, and special character'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.findOneAndUpdate(
            { email },
            { password: hashedPassword },
            { new: true }
        );

        if (!user) {
            return res.render('user/reset-password', {
                error: MESSAGES.AUTH.USER_NOT_FOUND || 'User not found'
            });
        }

        // Clear session
        req.session.forgotEmail = null;
        req.session.otpVerified = null;

        res.redirect('/login?reset=success');
    } catch (error) {
        console.error('Reset password error:', error);
        res.render('user/reset-password', {
            error: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'Something went wrong. Try again.'
        });
    }
};