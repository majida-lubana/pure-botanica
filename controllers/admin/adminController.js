

import User from '../../models/userSchema.js';
import bcrypt from 'bcrypt';
import MESSAGES from '../../constants/messages.js';

export const loadLogin = async (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }
    res.render("admin/login", {
        layout: false,
        message: null,
        pageTitle: 'Login Page'
    });
};

export const pageError = (req, res) => {
    res.render('admin/admin-error', {
        pageTitle: 'Admin Error',
        heading: 'Oops! Something Went Wrong',
        userName: 'Admin',
        imageURL: '/images/admin-avatar.jpg',
        message: req.query.message || MESSAGES.COMMON.SOMETHING_WENT_WRONG,
    });
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await User.findOne({ isAdmin: true, email }).select('+password');

        if (!admin) {
            return res.render('admin/login', {
                layout: 'layouts/adminLayout',
                message: MESSAGES.AUTH.LOGIN_FAILED,
                pageTitle: 'Login Page'
            });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (passwordMatch) {
            req.session.admin = true;
            req.session.adminId = admin._id;
            return res.redirect('/admin/dashboard');
        } else {
            return res.render('admin/login', {
                message: MESSAGES.AUTH.LOGIN_FAILED,
                pageTitle: 'Login Page'
            });
        }
    } catch (error) {
        console.log('Login error:', error);
        return res.redirect(`/admin/admin-error?message=${encodeURIComponent(MESSAGES.COMMON.SOMETHING_WENT_WRONG)}`);
    }
};

export const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log('Error destroying session:', err);
                return res.redirect(`/admin/admin-error?message=${encodeURIComponent(MESSAGES.COMMON.SOMETHING_WENT_WRONG)}`);
            }
            res.redirect('/admin/login');
        });
    } catch (error) {
        console.log('Unexpected error during logout:', error);
        res.redirect(`/admin/admin-error?message=${encodeURIComponent(MESSAGES.COMMON.SOMETHING_WENT_WRONG)}`);
    }
};