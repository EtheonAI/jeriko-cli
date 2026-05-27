import type { AuthStep } from "../_types/login";

type AuthError = {
  code?: string;
  message?: string;
};

type SignInErrorResult = {
  message: string;
  nextStep?: AuthStep;
};

export function getNetworkErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";

  if (message.toLowerCase().includes("failed to fetch")) {
    return "Unable to reach the server. Please check your connection and try again.";
  }

  return fallback;
}

export function getSignUpErrorMessage(error: AuthError) {
  switch (error.code) {
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Try signing in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Password must be at least 12 characters.";
    case "PASSWORD_TOO_LONG":
      return "Password must be less than 128 characters.";
    case "TOO_MANY_REQUESTS":
      return "Too many attempts. Please wait a moment and try again.";
    case "VALIDATION_ERROR":
      return "Please check your email and password.";
    default:
      return error.message || "Failed to create account. Please try again.";
  }
}

export function getSignInErrorResult(error: AuthError): SignInErrorResult {
  switch (error.code) {
    case "EMAIL_NOT_VERIFIED":
      return {
        message: "Please verify your email address before signing in.",
        nextStep: "verify",
      };
    case "INVALID_EMAIL_OR_PASSWORD":
      return { message: "Incorrect email or password." };
    case "TOO_MANY_REQUESTS":
      return { message: "Too many attempts. Please wait a moment and try again." };
    case "VALIDATION_ERROR":
      return { message: "Please enter a valid email and password." };
    default:
      return {
        message: error.message || "Sign in failed. Please try again.",
      };
  }
}
