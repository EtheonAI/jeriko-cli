# packages/auth — Testing Rules

## What This Is
Better-Auth (NOT Clerk) authentication: session management, OAuth, email/password. Used by apps/app via proxy.ts.

## Key Files
- `src/server.ts` — Auth server configuration
- `lib/validations/auth.ts` — Zod schemas for auth inputs

## Test Rules

### Session Testing
1. Session creation on login (cookie set)
2. Session validation on protected routes
3. Session expiry after timeout
4. Session invalidation on logout
5. Multiple concurrent sessions per user
6. Session fixation prevention (new session ID on login)

### Auth Flow Testing
1. Email/password: register → verify → login → logout
2. OAuth: redirect → callback → session create
3. Password reset: request → email → reset → login with new password
4. Input validation: email format, password strength, CSRF token

### proxy.ts Integration (Next.js 16)
- proxy.ts (NOT middleware.ts!) handles auth redirects
- Unauthenticated → redirect to /sign-in
- Public routes (/sign-in, /sign-up, /api/auth, /api/health) → pass through
- Authenticated → pass through with user context
- Security headers (X-Frame-Options, X-Content-Type-Options)

### Security Tests
1. CSRF protection — reject cross-origin requests
2. Session fixation — new session ID on login
3. Brute force — rate limit login attempts
4. No sensitive data in error responses (no DATABASE_URL, API_KEY, passwords)
5. Cookie flags: httpOnly, secure, sameSite
