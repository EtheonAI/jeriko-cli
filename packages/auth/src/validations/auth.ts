import { z } from "zod";

// Password validation rules:
// - Minimum 12 characters
// - At least 1 letter (uppercase or lowercase)
// - At least 1 special character
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least 1 letter")
  .regex(
    /[!@#$%^&*(),.?":{}|<>]/,
    "Password must contain at least 1 special character"
  );

// Email validation
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .transform((email) => email.toLowerCase().trim());

// Sign In Schema
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

// Sign Up Schema - simplified (no name, no confirm password)
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Forgot Password Schema
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Reset Password Schema
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// Type exports
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
