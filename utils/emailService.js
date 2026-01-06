

import nodemailer from 'nodemailer';

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
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Beauty Pronounced! ✨</h2>
        <p>Your verification OTP is: <strong style="font-size: 24px; color: #e91e63;">${otp}</strong></p>
        <p>This OTP is valid for <strong>10 minutes</strong>.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br><strong>Beauty Pronounced Team</strong></p>
      </div>
    `,
  });

  return info.accepted && info.accepted.length > 0;
}

function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString(); 
}

export { sendVerificationEmail, generateOtp };
export default { sendVerificationEmail, generateOtp };