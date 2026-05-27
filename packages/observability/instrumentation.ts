import { keys } from "./keys";

export const initializeSentry = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeSentry: initServer } = await import("./server");
    await initServer();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const { initializeSentry: initEdge } = await import("./edge");
    await initEdge();
  }
};

export const onRequestError: typeof import("@sentry/nextjs").captureRequestError = async (
  ...args
) => {
  if (!keys().NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
