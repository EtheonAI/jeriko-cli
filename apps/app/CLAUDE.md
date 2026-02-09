# apps/app — Testing Rules

## Framework
- **Vitest 4.x** + jsdom + @testing-library/react 16.3.x
- **Playwright 1.58.x** for E2E
- Config: `vitest.config.mts`, `playwright.config.ts`

## Test Commands
```bash
pnpm test                    # Unit/integration tests
pnpm test:e2e                # Playwright E2E
pnpm test:e2e:headed         # E2E with browser visible
pnpm test -- --watch         # Watch mode
pnpm test -- --coverage      # Coverage report
```

## Test Locations
- Unit: `__tests__/**/*.test.{ts,tsx}`
- Chat pipeline: `lib/chat/__tests__/*.test.ts`
- E2E: `e2e/features/*.spec.ts`
- E2E helpers: `e2e/helpers/`, `e2e/page-objects/`

## Rules
1. Every new page/component gets a unit test in `__tests__/`
2. Every API route gets at minimum a happy-path + error test
3. E2E: Use page objects from `e2e/page-objects/`, never raw selectors
4. Mock next/navigation, tRPC client, and design system components
5. Use `@repo/testing/factories` for test data — never inline objects
6. Use `@repo/testing/msw` for API mocking — never mock fetch directly in integration tests
7. proxy.ts (NOT middleware.ts) — Next.js 16 renamed this. Test auth redirects against proxy.ts.

## Common Mocks
```typescript
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/chat/123",
  useParams: () => ({ id: "123" }),
}));
```

## Critical Test Areas
- **Chat route** (`app/api/chat/route.ts`): SSE streaming, auth, resume (GET), body validation
- **proxy.ts**: Auth redirects, public routes, security headers
- **Dashboard** (`app/(authenticated)/page.tsx`): Session creation flow
- **Settings**: Each tab renders and saves correctly
