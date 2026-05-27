import { afterEach, describe, expect, it, vi } from "vitest";

const sentryMock = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureRequestError: vi.fn(),
}));

vi.mock("@logtail/next", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  withBetterStack: vi.fn((config) => config),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: sentryMock.captureException,
  captureRequestError: sentryMock.captureRequestError,
}));

describe("@repo/observability", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    sentryMock.captureException.mockClear();
    sentryMock.captureRequestError.mockClear();
  });

  it("can import the root package contract", async () => {
    await expect(import("../index")).resolves.toMatchObject({
      captureException: expect.any(Function),
      parseError: expect.any(Function),
      log: expect.any(Object),
    });
  });

  it("does not import Sentry capture without a DSN", async () => {
    const { captureException } = await import("../error");

    await captureException(new Error("skip"));

    expect(sentryMock.captureException).not.toHaveBeenCalled();
  });

  it("forwards exception capture when a DSN is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    const error = new Error("captured");
    const { captureException } = await import("../error");

    await captureException(error);

    expect(sentryMock.captureException).toHaveBeenCalledWith(error);
  });

  it("forwards request errors when a DSN is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    const error = new Error("request");
    const request = {
      headers: {},
      method: "GET",
      path: "/dashboard",
    };
    const context = {
      renderSource: "server-rendering",
      renderType: "dynamic",
      revalidateReason: undefined,
      routePath: "/",
      routeType: "render",
      routerKind: "App Router",
    };
    const { onRequestError } = await import("../instrumentation");

    await onRequestError(error, request, context);

    expect(sentryMock.captureRequestError).toHaveBeenCalledWith(error, request, context);
  });
});
