import { afterEach, describe, expect, it, vi } from "vitest";

const arcjetMock = vi.hoisted(() => ({
  create: vi.fn(() => {
    throw new Error("Arcjet should not be constructed in skip paths");
  }),
}));

vi.mock("@arcjet/next", () => ({
  default: arcjetMock.create,
  detectBot: vi.fn(),
  request: vi.fn(),
  shield: vi.fn(),
}));

describe("@repo/security secure", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    arcjetMock.create.mockClear();
  });

  it("does not construct Arcjet without ARCJET_KEY", async () => {
    vi.stubEnv("ARCJET_KEY", "");

    const { secure } = await import("../index");

    await expect(secure(["CATEGORY:PREVIEW"])).resolves.toBeUndefined();
    expect(arcjetMock.create).not.toHaveBeenCalled();
  });

  it("does not construct Arcjet in development", async () => {
    vi.stubEnv("ARCJET_KEY", "ajkey_test_123456789");
    vi.stubEnv("NODE_ENV", "development");

    const { secure } = await import("../index");

    await expect(secure(["CATEGORY:PREVIEW"])).resolves.toBeUndefined();
    expect(arcjetMock.create).not.toHaveBeenCalled();
  });
});
