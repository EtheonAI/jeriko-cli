/**
 * tRPC createCaller helper for integration tests.
 *
 * Creates a tRPC caller with a mocked auth session so you can
 * call procedures directly without HTTP.
 *
 * Usage:
 *   import { createTestCaller } from "@repo/testing/helpers/trpc-caller";
 *   const caller = createTestCaller(appRouter, { userId: "test-user" });
 *   const sessions = await caller.sessions.list();
 */
import { vi } from "vitest";

export interface TestSession {
  userId: string;
  email?: string;
  name?: string;
  sessionId?: string;
}

const DEFAULT_SESSION: TestSession = {
  userId: "test-user-id",
  email: "test@rubic.dev",
  name: "Test User",
  sessionId: "test-session-id",
};

/**
 * Create a mock context object that tRPC routers expect.
 * Includes a fake auth session + database reference.
 */
export function createTestContext(session?: Partial<TestSession>) {
  const mergedSession = { ...DEFAULT_SESSION, ...session };

  return {
    session: {
      user: {
        id: mergedSession.userId,
        name: mergedSession.name ?? "Test User",
        email: mergedSession.email ?? "test@rubic.dev",
        image: null,
      },
      session: {
        id: mergedSession.sessionId ?? "test-session-id",
        userId: mergedSession.userId,
      },
    },
    headers: new Headers(),
    req: {
      headers: {
        "x-user-id": mergedSession.userId,
      },
    },
  };
}

/**
 * Create a mock auth session for middleware testing.
 */
export function createMockAuthSession(overrides?: Partial<TestSession>) {
  const session = { ...DEFAULT_SESSION, ...overrides };
  return {
    user: {
      id: session.userId,
      name: session.name ?? "Test User",
      email: session.email ?? "test@rubic.dev",
      image: null,
      emailVerified: true,
    },
    session: {
      id: session.sessionId ?? "test-session-id",
      userId: session.userId,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  };
}

/**
 * Setup auth mock that returns a specific session.
 * Use at the top of test files (vi.mock is hoisted).
 */
export function mockAuth(session?: Partial<TestSession>) {
  const authSession = createMockAuthSession(session);

  vi.mock("@repo/auth/server", () => ({
    auth: {
      api: {
        getSession: vi.fn().mockResolvedValue(authSession),
      },
    },
  }));

  return authSession;
}
