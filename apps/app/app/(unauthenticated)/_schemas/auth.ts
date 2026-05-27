import { emailSchema as authEmailSchema, passwordSchema } from "@repo/auth/validations";
import { z } from "zod";

const emailFieldSchema = authEmailSchema;

export const emailSchema = z.object({
  email: emailFieldSchema,
});

export const signUpFormSchema = z.object({
  password: passwordSchema,
});

export const signInFormSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: emailFieldSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type EmailFormData = z.infer<typeof emailSchema>;
export type SignUpFormData = z.infer<typeof signUpFormSchema>;
export type SignInFormData = z.infer<typeof signInFormSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
