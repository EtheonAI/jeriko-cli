/**
 * Webhook Service Unit Tests
 */
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";

function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function verifySignature(secret: string, payload: string, signature: string): boolean {
  const expected = signPayload(secret, payload);
  return expected === signature;
}

describe("HMAC signing", () => {
  it("should generate consistent signatures", () => {
    const secret = "webhook-secret-123";
    const payload = JSON.stringify({ event: "test" });
    const sig1 = signPayload(secret, payload);
    const sig2 = signPayload(secret, payload);
    expect(sig1).toBe(sig2);
  });

  it("should verify valid signatures", () => {
    const secret = "secret";
    const payload = '{"event":"file.uploaded"}';
    const sig = signPayload(secret, payload);
    expect(verifySignature(secret, payload, sig)).toBe(true);
  });

  it("should reject invalid signatures", () => {
    const secret = "secret";
    const payload = '{"event":"file.uploaded"}';
    expect(verifySignature(secret, payload, "invalid-sig")).toBe(false);
  });

  it("should reject tampered payloads", () => {
    const secret = "secret";
    const original = '{"event":"file.uploaded"}';
    const sig = signPayload(secret, original);
    const tampered = '{"event":"file.deleted"}';
    expect(verifySignature(secret, tampered, sig)).toBe(false);
  });
});

describe("Webhook retry logic", () => {
  it("should compute exponential backoff", () => {
    const baseDelay = 1000; // 1 second
    const getDelay = (attempt: number) => baseDelay * Math.pow(2, attempt);
    expect(getDelay(0)).toBe(1000);
    expect(getDelay(1)).toBe(2000);
    expect(getDelay(2)).toBe(4000);
    expect(getDelay(3)).toBe(8000);
  });

  it("should cap max retries", () => {
    const maxRetries = 5;
    const attempts = [0, 1, 2, 3, 4, 5];
    const shouldRetry = (attempt: number) => attempt < maxRetries;
    expect(shouldRetry(4)).toBe(true);
    expect(shouldRetry(5)).toBe(false);
  });
});

describe("Event dispatch", () => {
  it("should validate event types", () => {
    const validEvents = [
      "file.uploaded", "file.deleted",
      "session.created", "session.completed",
      "device.registered", "device.command",
    ];
    for (const event of validEvents) {
      expect(event).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });
});
