import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const publicRoutes = [
  "/login",
  "/login/password",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/register", // Keep for backwards compatibility
];

// Auth-related paths that should redirect authenticated users
const authPages = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const e2eAuthBypass = process.env.E2E_AUTH_BYPASS === "true";

  if (e2eAuthBypass) {
    return NextResponse.next();
  }

  // Allow all auth API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow static files and images
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if the current path is an auth page
  const isAuthPage = authPages.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Get session from Better-Auth via cookie
  const sessionCookie = request.cookies.get("better-auth.session_token");
  const isLoggedIn = !!sessionCookie?.value;

  // Redirect authenticated users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isPublicRoute) {
    const callbackUrl = encodeURIComponent(
      pathname + request.nextUrl.search
    );
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
