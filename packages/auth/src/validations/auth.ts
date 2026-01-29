import { z } from "zod";

export const userAuthSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be less than 128 characters"),
});

export const signUpSchema = userAuthSchema.extend({
  name: z.string().min(1, "Name is required").max(100).optional(),
  confirmPassword: z.string().optional(),
}).refine(
  (data) => !data.confirmPassword || data.password === data.confirmPassword,
  {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  }
);

export type UserAuthInput = z.infer<typeof userAuthSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
