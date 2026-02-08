import { describe, it, expect } from "vitest";
import {
  detectQuotaError,
  isQuotaError,
  extractErrorMessage,
} from "../error-detection";

// ============================================================
// detectQuotaError
// ============================================================
describe("detectQuotaError", () => {
  it('returns true for "exceeded your current quota"', () => {
    expect(
      detectQuotaError("You have exceeded your current quota")
    ).toBe(true);
  });

  it('returns true for "rate limit"', () => {
    expect(detectQuotaError("rate limit reached for model")).toBe(true);
  });

  it('returns true for "billing hard limit"', () => {
    expect(
      detectQuotaError("You have hit your billing hard limit")
    ).toBe(true);
  });

  it('returns true for "insufficient_quota"', () => {
    expect(detectQuotaError("Error: insufficient_quota")).toBe(true);
  });

  it('returns true for "overloaded"', () => {
    expect(detectQuotaError("The server is overloaded")).toBe(true);
  });

  it('returns true for "credit balance is too low"', () => {
    expect(
      detectQuotaError("Your credit balance is too low")
    ).toBe(true);
  });

  it('returns false for "normal error message"', () => {
    expect(detectQuotaError("normal error message")).toBe(false);
  });

  it('returns false for "success"', () => {
    expect(detectQuotaError("success")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(detectQuotaError("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(detectQuotaError("EXCEEDED YOUR CURRENT QUOTA")).toBe(true);
    expect(detectQuotaError("Rate Limit")).toBe(true);
    expect(detectQuotaError("BILLING HARD LIMIT")).toBe(true);
  });

  it('matches the "exceeded.*quota" regex pattern', () => {
    expect(
      detectQuotaError("You have exceeded the monthly quota")
    ).toBe(true);
  });

  it("detects quota errors embedded in JSON strings", () => {
    expect(
      detectQuotaError(
        '{"error":{"message":"You exceeded your current quota, please check your plan"}}'
      )
    ).toBe(true);
  });
});

// ============================================================
// isQuotaError
// ============================================================
describe("isQuotaError", () => {
  it("returns true for an Error with a quota message", () => {
    expect(
      isQuotaError(new Error("exceeded your current quota"))
    ).toBe(true);
  });

  it("returns false for an Error with a normal message", () => {
    expect(isQuotaError(new Error("something went wrong"))).toBe(false);
  });

  it("returns true for an object with status 429", () => {
    expect(isQuotaError({ status: 429 })).toBe(true);
  });

  it("returns true for an object with status 402", () => {
    expect(isQuotaError({ status: 402 })).toBe(true);
  });

  it("returns false for an object with status 500", () => {
    expect(isQuotaError({ status: 500 })).toBe(false);
  });

  it("returns true for a string quota message", () => {
    expect(isQuotaError("rate limit exceeded")).toBe(true);
  });

  it("returns false for null", () => {
    expect(isQuotaError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isQuotaError(undefined)).toBe(false);
  });

  it("returns true for an object with statusCode 429", () => {
    expect(isQuotaError({ statusCode: 429 })).toBe(true);
  });

  it("returns true for an object with statusCode 402", () => {
    expect(isQuotaError({ statusCode: 402 })).toBe(true);
  });

  it("returns true for an Error that also has status 429", () => {
    const err = new Error("API error");
    (err as unknown as Record<string, unknown>).status = 429;
    expect(isQuotaError(err)).toBe(true);
  });

  it("returns false for a non-quota string", () => {
    expect(isQuotaError("everything is fine")).toBe(false);
  });

  it("returns false for status 200", () => {
    expect(isQuotaError({ status: 200 })).toBe(false);
  });
});

// ============================================================
// extractErrorMessage
// ============================================================
describe("extractErrorMessage", () => {
  it("returns the string directly when given a string", () => {
    expect(extractErrorMessage("something broke")).toBe("something broke");
  });

  it('extracts message from { message: "msg" }', () => {
    expect(extractErrorMessage({ message: "msg" })).toBe("msg");
  });

  it('extracts error from { error: "err" }', () => {
    expect(extractErrorMessage({ error: "err" })).toBe("err");
  });

  it('extracts nested message from { error: { message: "deep" } }', () => {
    expect(
      extractErrorMessage({ error: { message: "deep" } })
    ).toBe("deep");
  });

  it('returns "Unknown error" for null', () => {
    expect(extractErrorMessage(null)).toBe("Unknown error");
  });

  it('returns "Unknown error" for undefined', () => {
    expect(extractErrorMessage(undefined)).toBe("Unknown error");
  });

  it('returns "Unknown error" for a number', () => {
    expect(extractErrorMessage(42)).toBe("Unknown error");
  });

  it('returns "Unknown error" for a boolean', () => {
    expect(extractErrorMessage(true)).toBe("Unknown error");
  });

  it("returns JSON.stringify for a complex object without message or error", () => {
    const obj = { code: 500, details: "server failure" };
    expect(extractErrorMessage(obj)).toBe(JSON.stringify(obj));
  });

  it("extracts message from a real Error instance", () => {
    expect(extractErrorMessage(new Error("real error"))).toBe("real error");
  });

  it("prefers message over error when both exist", () => {
    expect(
      extractErrorMessage({ message: "msg", error: "err" })
    ).toBe("msg");
  });

  it("handles { error: { message, ... } } nested objects", () => {
    expect(
      extractErrorMessage({ error: { message: "nested", code: 1 } })
    ).toBe("nested");
  });

  it("falls back to JSON.stringify when error is an object without message", () => {
    const obj = { error: { code: 123 } };
    expect(extractErrorMessage(obj)).toBe(JSON.stringify(obj));
  });

  it("returns JSON.stringify for an object with non-string message", () => {
    const obj = { message: 42 };
    expect(extractErrorMessage(obj)).toBe(JSON.stringify(obj));
  });
});
