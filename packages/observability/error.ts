import { keys } from "./keys";
import { log } from "./log";

export const captureException = async (error: unknown): Promise<void> => {
  if (!keys().NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error);
  } catch (captureError) {
    const message = captureError instanceof Error ? captureError.message : String(captureError);
    log.error(`Failed to capture exception: ${message}`);
  }
};

export const parseError = (error: unknown): string => {
  let message = "An error occurred";

  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === "object" && "message" in error) {
    message = error.message as string;
  } else {
    message = String(error);
  }

  try {
    void captureException(error);
    log.error(`Parsing error: ${message}`);
  } catch (newError) {
    // biome-ignore lint/suspicious/noConsole: Need console here
    console.error("Error parsing error:", newError);
  }

  return message;
};
