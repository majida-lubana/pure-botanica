import bcrypt from 'bcrypt';
import User from '../../models/userSchema.js';
import { generateOtp, sendVerificationEmail } from '../../utils/emailService.js';
import STATUS from '../../constants/statusCode.js';
import MESSAGES from '../../constants/messages.js';

export const loadUserProfile = async (req, res) => {
    try {
        let userId;
        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        }

        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        if (user) {
            res.render('user/profile', { user });
        } else {
            return res.redirect('/login');
        }
    } catch (error) {
        console.error('Profile error:', error);
        res.redirect('/login');
    }
};

export const userProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);
        if (user) {
            res.render('user/profile', { user });
        } else {
            res.redirect('/pageNotFound');
        }
    } catch (error) {
        console.error('User profile error:', error);
        res.redirect('/pageNotFound');
    }
};

export const updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        let userId;

        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        }

        if (!userId) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.AUTH.UNAUTHORIZED || 'Unauthorized: No user session found'
            });
        }

        if (!name) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PROFILE.NAME_REQUIRED || 'Name is required'
            });
        }

        const phoneRegex = /^\+?[\d\s-]{8,10}$/;
        if (phone && !phoneRegex.test(phone)) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PROFILE.INVALID_PHONE || 'Invalid phone number format'
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { name, phone },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.AUTH.USER_NOT_FOUND || 'User not found'
            });
        }

        req.session.user = user;

        res.status(STATUS.OK).json({
            success: true,
            message: MESSAGES.PROFILE.UPDATED_SUCCESS || 'Profile updated successfully',
            user: { name: user.name, phone: user.phone }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'An error occurred. Please try again.'
        });
    }
};

export const sendEmailOtp = async (req, res) => {
    try {
        const { email } = req.body;
        let userId;

        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        } else if (req.user) {
            userId = req.user._id;
        }

        if (!userId) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.AUTH.UNAUTHORIZED || 'Unauthorized: No user session found'
            });
        }

        if (!email) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PROFILE.EMAIL_REQUIRED || 'Email is required'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PROFILE.INVALID_EMAIL || 'Invalid email format'
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser._id.toString() !== userId) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PROFILE.EMAIL_IN_USE || 'Email is already in use by another account'
            });
        }

        const otp = generateOtp();
        console.log('OTP   :', otp);
        const sent = await sendVerificationEmail(email, otp);

        if (!sent) {
            return res.status(STATUS.INTERNAL_ERROR).json({
                success: false,
                message: MESSAGES.OTP.SEND_FAILED || 'Failed to send OTP'
            });
        }

        req.session.emailChangeOtp = otp;
        req.session.emailChangeEmail = email;
        req.session.emailChangeTimestamp = Date.now();

        return res.status(STATUS.OK).json({
            success: true,
            message: MESSAGES.OTP.SENT_SUCCESS || 'OTP sent successfully'
        });
    } catch (error) {
        console.error('Error in sendEmailOtp:', error);
        return res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'An error occurred. Please try again.'
        });
    }
};

export const verifyEmailOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        let userId;

        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        } else if (req.user) {
            userId = req.user._id;
        }

        if (!userId) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.AUTH.UNAUTHORIZED || 'Unauthorized: No user session found'
            });
        }

        if (!email || !otp) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.OTP.MISSING_FIELDS || 'Email and OTP are required'
            });
        }

        const sessionOtp = req.session.emailChangeOtp;
        const sessionEmail = req.session.emailChangeEmail;
        const otpTimestamp = req.session.emailChangeTimestamp;

        if (!sessionOtp || !sessionEmail || !otpTimestamp) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.OTP.NOT_FOUND || 'OTP not found or expired'
            });
        }

        if (Date.now() - otpTimestamp > 300000) {
            delete req.session.emailChangeOtp;
            delete req.session.emailChangeEmail;
            delete req.session.emailChangeTimestamp;
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.OTP.EXPIRED || 'OTP has expired'
            });
        }

        if (email !== sessionEmail) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.OTP.EMAIL_MISMATCH || 'Email does not match the OTP request'
            });
        }

        if (String(otp) !== String(sessionOtp)) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.OTP.INVALID || 'Invalid OTP'
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { email },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.AUTH.USER_NOT_FOUND || 'User not found'
            });
        }

        if (req.session.user) {
            req.session.user = user;
        }

        delete req.session.emailChangeOtp;
        delete req.session.emailChangeEmail;
        delete req.session.emailChangeTimestamp;

        return res.status(STATUS.OK).json({
            success: true,
            message: MESSAGES.PROFILE.EMAIL_UPDATED || 'Email updated successfully'
        });
    } catch (error) {
        console.error('Error in verifyEmailOtp:', error);
        return res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'An error occurred. Please try again.'
        });
    }
};

export const resendEmailOtp = async (req, res) => {
    try {
        const email = req.session.emailChangeEmail;
        let userId;

        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        } else if (req.user) {
            userId = req.user._id;
        }

        if (!userId) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.AUTH.UNAUTHORIZED || 'Unauthorized: No user session found'
            });
        }

        if (!email) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.SESSION.EMAIL_NOT_FOUND || 'Email not found in session'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PROFILE.INVALID_EMAIL || 'Invalid email format'
            });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser._id.toString() !== userId) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PROFILE.EMAIL_IN_USE || 'Email is already in use by another account'
            });
        }

        const otp = generateOtp();
        console.log('RESENDOTP   :', otp);
        const sent = await sendVerificationEmail(email, otp);

        if (!sent) {
            return res.status(STATUS.INTERNAL_ERROR).json({
                success: false,
                message: MESSAGES.OTP.SEND_FAILED || 'Failed to send OTP'
            });
        }

        req.session.emailChangeOtp = otp;
        req.session.emailChangeTimestamp = Date.now();

        return res.status(STATUS.OK).json({
            success: true,
            message: MESSAGES.OTP.RESENT_SUCCESS || 'New OTP sent successfully'
        });
    } catch (error) {
        console.error('Error in resendEmailOtp:', error);
        return res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'An error occurred. Please try again.'
        });
    }
};

export const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        let userId;

        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        }

        if (!userId) {
            return res.status(STATUS.UNAUTHORIZED).json({
                success: false,
                message: MESSAGES.AUTH.UNAUTHORIZED || 'Unauthorized: No user session found'
            });
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PASSWORD.REQUIRED_FIELDS || 'All fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PASSWORD.MISMATCH || 'Passwords do not match'
            });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PASSWORD.INVALID_FORMAT || 'Password does not meet requirements'
            });
        }

        const user = await User.findById(userId).select('+password');
        if (!user) {
            return res.status(STATUS.NOT_FOUND).json({
                success: false,
                message: MESSAGES.AUTH.USER_NOT_FOUND || 'User not found'
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(STATUS.BAD_REQUEST).json({
                success: false,
                message: MESSAGES.PASSWORD.INCORRECT_CURRENT || 'Current password is incorrect'
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(STATUS.OK).json({
            success: true,
            message: MESSAGES.PASSWORD.UPDATED_SUCCESS || 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(STATUS.INTERNAL_ERROR).json({
            success: false,
            message: MESSAGES.COMMON.SOMETHING_WENT_WRONG || 'An error occurred. Please try again.'
        });
    }
};


export default {
    loadUserProfile,
    userProfile,
    updateProfile,
    sendEmailOtp,
    verifyEmailOtp,
    resendEmailOtp,
    updatePassword
};