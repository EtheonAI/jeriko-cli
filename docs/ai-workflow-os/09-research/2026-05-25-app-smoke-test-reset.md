# apps/app Smoke Test Reset

Date researched: 2026-05-25

## Sources

| Source                     | Type                            | URL                                                               | Claim checked                                                                                                                       |
| -------------------------- | ------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Next.js Vitest guide       | Official docs                   | https://nextjs.org/docs/app/guides/testing/vitest                 | Next.js documents Vitest setup for unit tests and warns that async Server Components should be covered with E2E rather than Vitest. |
| Next.js redirect docs      | Official docs                   | https://nextjs.org/docs/app/api-reference/functions/redirect      | `redirect()` does not return; it throws and normally emits a 307 response outside Server Actions.                                   |
| Vitest test projects guide | Official docs                   | https://vitest.dev/guide/projects                                 | Vitest 4 uses `test.projects` for monorepos; `workspace` naming is deprecated.                                                      |
| Vite 8 migration guide     | Official docs                   | https://vite.dev/guide/migration.html                             | Vite 8 uses OXC for JavaScript transforms; `esbuild.jsx: 'automatic'` maps to `oxc.jsx: { runtime: 'automatic' }`.                  |
| Local package check        | Local registry/install evidence | `npm view vitest version`; `./node_modules/.bin/vitest --version` | Latest/current Vitest is `4.1.7` in this repo.                                                                                      |
| Local Next 16.2.6 source   | Installed package source        | `apps/app/node_modules/next/dist/client/components/redirect.js`   | Next encodes redirect errors as `NEXT_REDIRECT;type;url;status;`.                                                                   |

## Findings

- The old `apps/app` test suite targeted deleted Manus clone routes, chat/SSE/tRPC internals, Redux slices, and old E2E fixtures.
- The reset shell needs only a minimal guardrail until product contracts return:
  - dashboard page renders;
  - authenticated root redirects to `/dashboard`;
  - proxy allows public auth pages;
  - proxy sends unauthenticated app routes to `/login?callbackUrl=...`;
  - proxy sends authenticated users away from `/login`.
- Next's current Vitest guidance supports synchronous component/unit tests, but explicitly does not make Vitest the right layer for async Server Component behavior.
- Vitest's current monorepo guidance supports root `test.projects`, so `apps/app/vitest.config.ts` should be added as another project instead of restoring a stale `vitest.workspace.ts`.
- Because `apps/app` correctly inherits Next's `jsx: preserve`, the app Vitest project needs an explicit Vite 8 OXC JSX transform for TSX imports.
- Next's `redirect("/dashboard")` test should assert the redirect error digest, not a returned value.

## Decision Impact

- Do not restore the deleted old app test tree.
- Add a small app-local Vitest project in Node environment.
- Avoid adding browser/E2E tooling during reset. Bring Playwright/browser tests back only after the real workflow UX exists.
- Keep `test:smoke` pointed at the app Vitest project.

## Open Questions

- After Better Auth cleanup, add an auth API integration smoke that exercises the current Better Auth route and social providers with documented test adapters/mocks.
- After the workflow shell exists, add route-level browser smoke tests for the real sidebar, command input, workflow run screen, and file/artifact rendering.
