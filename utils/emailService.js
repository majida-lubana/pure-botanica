const nodemailer = require("nodemailer");

async function sendVerificationEmail(email, otp) {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
    throw new Error("Missing email credentials in env file");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: `"Beauty Pronounced" <${process.env.NODEMAILER_EMAIL}>`,
    to: email,
    subject: "Verify Your Account",
    text: `Your OTP is ${otp}`,
    html: `<b>Your OTP: ${otp}</b>`,
  });

  return info.accepted && info.accepted.length > 0;
}

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

module.exports = { sendVerificationEmail, generateOtp };
