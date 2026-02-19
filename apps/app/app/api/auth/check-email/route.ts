import { NextResponse } from "next/server";
import { db, users, accounts, eq, and } from "@repo/database";

// Simple in-memory rate limiter (per IP, 5 requests per 60 seconds)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 60 seconds
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/** Constant-time padding to prevent timing-based email enumeration */
const MIN_RESPONSE_TIME_MS = 100;

async function withConstantTime<T>(fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  const remaining = MIN_RESPONSE_TIME_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  return result;
}

export async function POST(request: Request) {
  // Rate limit by IP to prevent email enumeration
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  return withConstantTime(async () => {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email || typeof email !== "string") {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 }
        );
      }

      // Normalize email to lowercase
      const normalizedEmail = email.toLowerCase().trim();

      // Check if user exists, has a credential account, and email verification status
      const existingUser = await db
        .select({ id: users.id, emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      let hasCredential = false;
      if (existingUser[0]) {
        const credentialAccount = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, existingUser[0].id),
              eq(accounts.providerId, "credential")
            )
          )
          .limit(1);
        hasCredential = credentialAccount.length > 0;
      }

      return NextResponse.json({
        // Only treat as "existing" if they have a credential account to sign in with.
        // Users without credentials (orphaned records) should go through sign-up.
        exists: existingUser.length > 0 && hasCredential,
        emailVerified: existingUser[0]?.emailVerified ?? false,
      });
    } catch (error) {
      console.error("Check email error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  });
}
