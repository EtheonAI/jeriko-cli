import { vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// Mock @repo/auth/server
vi.mock("@repo/auth/server", () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue({
        user: {
          id: "test-user-id",
          name: "Test User",
          email: "test@rubic.dev",
          image: null,
        },
        session: {
          id: "test-session-id",
          userId: "test-user-id",
        },
      }),
    },
  },
}));

// Mock @repo/search (non-blocking sync calls)
vi.mock("@repo/search", () => ({
  syncSessionToSearch: vi.fn().mockResolvedValue(undefined),
  removeSessionFromSearch: vi.fn().mockResolvedValue(undefined),
  syncActionToSearch: vi.fn().mockResolvedValue(undefined),
}));
