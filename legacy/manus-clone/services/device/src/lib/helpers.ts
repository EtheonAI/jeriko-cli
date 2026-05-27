import { createLogger, ErrorCodes, type Logger } from "@repo/service-utils";

export const logger: Logger = createLogger({ service: "device" });

export function getUserId(request: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const userId = request.headers["x-user-id"] as string | undefined;
  if (!userId) {
    const error = new Error("Unauthorized") as Error & { statusCode: number; code: string };
    error.statusCode = 401;
    error.code = ErrorCodes.UNAUTHORIZED;
    throw error;
  }
  return userId;
}
