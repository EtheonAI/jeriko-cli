import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("@repo/rate-limit", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("can be imported without Upstash credentials", async () => {
    await expect(import("../index")).resolves.toMatchObject({
      createRateLimiter: expect.any(Function),
      slidingWindow: expect.any(Function),
    });
  });

  it("fails clearly when creating a limiter without Upstash credentials", async () => {
    const { createRateLimiter, slidingWindow } = await import("../index");

    expect(() =>
      createRateLimiter({
        limiter: slidingWindow(1, "1 m"),
      })
    ).toThrow("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
  });
});
