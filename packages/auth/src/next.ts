import { getSessionCookie } from "better-auth/cookies";
import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";
import { auth } from "./server";

export const authRouteHandlers = toNextJsHandler(auth);

export function hasSessionCookie(request: NextRequest) {
  return !!getSessionCookie(request);
}
