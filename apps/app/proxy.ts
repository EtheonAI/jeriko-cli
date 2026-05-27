import { hasSessionCookie } from "@repo/auth/next";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "@/env";

const PUBLIC_ROUTES = ["/login", "/verify-email", "/forgot-password", "/reset-password"] as const;

const PUBLIC_ROUTE_PREFIXES = ["/api/auth", "/api/health", "/.well-known/vercel/flags"] as const;

const AUTH_PAGES = ["/login"] as const;

const PUBLIC_FILE_PATTERN = /\.(?:avif|gif|ico|jpg|jpeg|png|svg|txt|webmanifest|webp|xml)$/i;

function matchesRoute(pathname: string, routes: readonly string[]) {
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isPublicPath(pathname: string) {
  return (
    matchesRoute(pathname, PUBLIC_ROUTES) ||
    matchesRoute(pathname, PUBLIC_ROUTE_PREFIXES) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    PUBLIC_FILE_PATTERN.test(pathname)
  );
}

function createLoginRedirect(request: NextRequest) {
  const callbackUrl = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);

  return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const e2eAuthBypass = env.E2E_AUTH_BYPASS === "true";

  if (e2eAuthBypass) {
    return NextResponse.next();
  }

  const isPublicRoute = isPublicPath(pathname);
  const isAuthPage = matchesRoute(pathname, AUTH_PAGES);

  // Optimistic redirect only. Authenticated layouts and APIs still validate
  // the real session with Better Auth before serving protected data.
  const isLoggedIn = hasSessionCookie(request);

  // Redirect authenticated users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isPublicRoute) {
    return createLoginRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
