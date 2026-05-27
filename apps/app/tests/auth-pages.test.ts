import { describe, expect, it } from "vitest";
import { getDefaultEmail } from "../app/(unauthenticated)/forgot-password/_lib/default-email";
import {
  getResetPasswordQuery,
  hasInvalidResetPasswordToken,
} from "../app/(unauthenticated)/reset-password/_lib/reset-password-query";
import { getVerificationEmail } from "../app/(unauthenticated)/verify-email/_lib/verification-email-query";

describe("auth page helpers", () => {
  it("normalizes a valid forgot-password email query", () => {
    expect(getDefaultEmail("USER@example.com")).toBe("user@example.com");
  });

  it("uses the first forgot-password email query value", () => {
    expect(getDefaultEmail(["first@example.com", "second@example.com"])).toBe("first@example.com");
  });

  it("drops invalid forgot-password email query values", () => {
    expect(getDefaultEmail("not-an-email")).toBe("");
    expect(getDefaultEmail(undefined)).toBe("");
  });

  it("normalizes reset-password token and error query values", () => {
    expect(
      getResetPasswordQuery({
        error: ["INVALID_TOKEN", "ignored"],
        token: ["abc123", "ignored"],
      })
    ).toEqual({
      error: "INVALID_TOKEN",
      token: "abc123",
    });
  });

  it("detects invalid reset-password token states", () => {
    expect(hasInvalidResetPasswordToken({ error: "", token: "" })).toBe(true);
    expect(
      hasInvalidResetPasswordToken({
        error: "INVALID_TOKEN",
        token: "abc123",
      })
    ).toBe(true);
    expect(hasInvalidResetPasswordToken({ error: "", token: "abc123" })).toBe(false);
  });

  it("normalizes a valid verify-email query", () => {
    expect(getVerificationEmail({ email: "USER@example.com" })).toBe("user@example.com");
  });

  it("drops invalid verify-email query values", () => {
    expect(getVerificationEmail({ email: "not-an-email" })).toBe("");
    expect(getVerificationEmail({})).toBe("");
  });
});
