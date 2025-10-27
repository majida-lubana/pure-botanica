const User = require('../../models/userSchema')
const bcrypt = require('bcrypt')
const {generateOtp, sendVerificationEmail } = require('../../utils/emailService')





exports.loadUserProfile = async (req, res) => {
    try {
        console.log('Profile route - Session user:', req.session.user);
        console.log('Profile route - Req user:', req.user);

        let userId;
        if (req.session.user) {

            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        }

        if (!userId) {
            console.log('No user ID found in session');
            return res.redirect('/login');
        }

        const user = await User.findById(userId);
        if (user) {
            res.render('user/profile', { user });
        } else {
            console.log('User not found in database');
            return res.redirect('/login');
        }
    } catch (error) {
        console.error('Profile error:', error);
        return res.redirect('/login');
    }
};

exports.userProfile = async (req, res) => {
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
exports.updateProfile = async (req, res) => {
    try {
        const { name, phone } = req.body;
        let userId;

        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user session found' });
        }

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        const phoneRegex = /^\+?[\d\s-]{8,10}$/;
        if (phone && !phoneRegex.test(phone)) {
            return res.status(400).json({ success: false, message: 'Invalid phone number format' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { name, phone },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

   
        req.session.user = user;

        res.status(200).json({ success: true, user: { name: user.name, phone: user.phone } });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
};



exports.sendEmailOtp = async (req, res) => {
    try {
        const { email } = req.body;
        let userId;

       
        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        } else if (req.user) {
            userId = req.user._id;
        }

        if (!userId) {
            console.log('No user ID found in session or req.user');
            return res.status(401).json({ success: false, message: 'Unauthorized: No user session found' });
        }

  
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

    
        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser._id.toString() !== userId) {
            return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
        }

        const otp = generateOtp();
        const sent = await sendVerificationEmail(email, otp);

        if (!sent) {
            return res.status(500).json({ success: false, message: 'Failed to send OTP' });
        }

   
        req.session.emailChangeOtp = otp;
        req.session.emailChangeEmail = email;
        req.session.emailChangeTimestamp = Date.now();
        console.log('Email Change OTP for', email, 'is:', otp);

        return res.status(200).json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error in sendEmailOtp:', error);
        return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
};

exports.verifyEmailOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        let userId;

     
        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        } else if (req.user) {
            userId = req.user._id;
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user session found' });
        }

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and OTP are required' });
        }


        const sessionOtp = req.session.emailChangeOtp;
        const sessionEmail = req.session.emailChangeEmail;
        const otpTimestamp = req.session.emailChangeTimestamp;

        if (!sessionOtp || !sessionEmail || !otpTimestamp) {
            return res.status(400).json({ success: false, message: 'OTP not found or expired' });
        }

        if (Date.now() - otpTimestamp > 300000) { 
            delete req.session.emailChangeOtp;
            delete req.session.emailChangeEmail;
            delete req.session.emailChangeTimestamp;
            return res.status(400).json({ success: false, message: 'OTP has expired' });
        }

        if (email !== sessionEmail) {
            return res.status(400).json({ success: false, message: 'Email does not match the OTP request' });
        }

        if (String(otp) !== String(sessionOtp)) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { email },
            { new: true, runValidators: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (req.session.user) {
            req.session.user = user;
        }


        delete req.session.emailChangeOtp;
        delete req.session.emailChangeEmail;
        delete req.session.emailChangeTimestamp;

        return res.status(200).json({ success: true, message: 'Email updated successfully' });
    } catch (error) {
        console.error('Error in verifyEmailOtp:', error);
        return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
};

exports.resendEmailOtp = async (req, res) => {
    try {
        const email = req.session.emailChangeEmail;
        let userId;

        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
        } else if (req.user) {
            userId = req.user._id;
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user session found' });
        }

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email not found in session' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser._id.toString() !== userId) {
            return res.status(400).json({ success: false, message: 'Email is already in use by another account' });
        }

        const otp = generateOtp();
        const sent = await sendVerificationEmail(email, otp);

        if (!sent) {
            return res.status(500).json({ success: false, message: 'Failed to send OTP' });
        }


        req.session.emailChangeOtp = otp;
        req.session.emailChangeTimestamp = Date.now();
        console.log('Resend Email Change OTP for', email, 'is:', otp);

        return res.status(200).json({ success: true, message: 'New OTP sent successfully' });
    } catch (error) {
        console.error('Error in resendEmailOtp:', error);
        return res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
};
exports.updatePassword = async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Session data:', req.session);
        const { currentPassword, newPassword, confirmPassword } = req.body;
        let userId;

        if (req.session.user) {
            userId = typeof req.session.user === 'string' ? req.session.user : req.session.user._id;
            console.log('Extracted userId:', userId);
        }

        if (!userId) {
            console.log('No session user found');
            return res.status(401).json({ success: false, message: 'Unauthorized: No user session found' });
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            console.log('Missing fields:', { currentPassword, newPassword, confirmPassword });
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (newPassword !== confirmPassword) {
            console.log('Passwords do not match');
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        console.log('Password regex test:', passwordRegex.test(newPassword));
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ success: false, message: 'Password does not meet requirements' });
        }

        const user = await User.findById(userId).select('+password')
        console.log('User found:', user);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        console.log('Password match:', isMatch);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        console.log('New password hashed');
        user.password = hashedPassword;
        await user.save();
        console.log('Password updated for user:', userId);

        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'An error occurred. Please try again.' });
    }
};