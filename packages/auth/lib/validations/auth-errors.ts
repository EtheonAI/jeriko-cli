import { CredentialsSignin } from "next-auth";

export class InvalidPasswordError extends CredentialsSignin {
  code = "invalid_password";
}

export class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

export class EmailNotVerifiedError extends CredentialsSignin {
  code = "email_not_verified";
}