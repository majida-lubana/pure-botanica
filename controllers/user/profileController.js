const User = require('../../models/userSchema')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const env = require('dotenv').config()
const session = require('express-session')


function generateOtp() {
    const digits = "1234567890";
    let otp = "";
    for (let i = 0; i < 4; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
}

exports.sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for Password Reset",
            text: `Your OTP is ${otp}`,
            html: `<h4>Your OTP: <strong>${otp}</strong></h4>`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return true;

    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
};

exports.getForgotPassPage = async (req, res) => {
    try {
        res.render('user/forgot-password');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

exports.forgotEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email });

        if (findUser) {
            const otp = generateOtp();
            const emailSent = await exports.sendVerificationEmail(email, otp);

            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render('user/forgotPass-otp');
                console.log('OTP sent:', otp);
            } else {
                res.json({ success: false, message: "Failed to send OTP. Please try again." });
            }

        } else {
            res.render('user/forgot-password', {
                message: "User with this email does not exist"
            });
        }

    } catch (error) {
        res.redirect('/pageNotFound');
    }
};
