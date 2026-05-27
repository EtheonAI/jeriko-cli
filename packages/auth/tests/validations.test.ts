import { describe, expect, it } from "vitest";
import {
  emailSchema,
  forgotPasswordSchema,
  passwordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "../src/validations/auth";

describe("@repo/auth validation schemas", () => {
  it("normalizes email addresses", () => {
    const result = emailSchema.parse("  USER@example.com  ");

    expect(result).toBe("user@example.com");
  });

  it("rejects invalid email addresses", () => {
    const result = emailSchema.safeParse("not-an-email");

    expect(result.success).toBe(false);
  });

  it("requires strong passwords for signup and reset flows", () => {
    expect(passwordSchema.safeParse("short!").success).toBe(false);
    expect(passwordSchema.safeParse("averylongpassword").success).toBe(false);
    expect(passwordSchema.safeParse("averylongpassword!").success).toBe(true);
  });

  it("validates sign-in, sign-up, and forgot-password payloads", () => {
    expect(
      signInSchema.safeParse({
        email: "USER@example.com",
        password: "password",
      }).success
    ).toBe(true);

    expect(
      signUpSchema.safeParse({
        email: "USER@example.com",
        password: "averylongpassword!",
      }).success
    ).toBe(true);

    expect(
      forgotPasswordSchema.safeParse({
        email: "USER@example.com",
      }).success
    ).toBe(true);
  });

  it("rejects reset-password confirmation mismatches", () => {
    const result = resetPasswordSchema.safeParse({
      password: "averylongpassword!",
      confirmPassword: "differentpassword!",
    });

    expect(result.success).toBe(false);
  });
});
