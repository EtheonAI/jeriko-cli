// Server-side auth (use in API routes and server components)
export { auth } from "./server";
export type { Auth, Session as ServerSession, User as ServerUser } from "./server";

// Validation schemas
export {
  passwordSchema,
  emailSchema,
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type SignInInput,
  type SignUpInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "./validations/auth";
