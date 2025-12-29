

const { z } = require("zod");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password too long")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number")
  .regex(/[@$!%*?&]/, "Must contain at least one special character");

exports.signupSchema = z.object({
  name: z.string()
    .min(3,"Name must be at least 3 characters")
    .max(50,"Name must not exceed 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),

  email: z.string()
    .email("Invalid email format")
    .toLowerCase(),
  
  phone: z.string()
    .min(10,"Phone number must be at least 10 digits")
    .max(15,"Phone number must not exceed 15 digits")
    .regex(/^[0-9+\-\s()]+$/, "Invalid phone number format"),

  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long")
    .regex(/[A-Z]/,"Must contain at least one uppercase letter")
    .regex(/[a-z]/,"Must contain at least one lowercase letter")
    .regex(/[0-9]/,"Must contain at least one number")
    .regex(/[@$!%*?&]/, "Must contain at least one special character"),
  
  confirmPassword: z.string()
    .min(1, "Confirm password is required"),
    referralCode: z.string()
    .min(6, "Referral code must be at least 6 characters")
    .max(10, "Referral code must not exceed 10 characters")
    .regex(/^[A-Z0-9]+$/, "Referral code must contain only uppercase letters and numbers")
    .optional()
    .or(z.literal(''))
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
})


exports.loginSchema = z.object({
  email: z.string()
    .email("Invalid email format" )
    .toLowerCase(),
  password: z.string()
    .min(1,"Password is required")
})

exports.forgotPasswordSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .toLowerCase()
})

// exports.resetPasswordSchema = z.object({
//   password:passwordSchema,
//   confirmPassword: z.string()
//     .min(1,'confirm password is required'),
//     token: z.string().min(1,'Reset token is required'),
// }).refine((data) => data.password === data.confirmPassword, {
//     message: "Passwords do not match",
//     path: ["confirmPassword"],
//   });
