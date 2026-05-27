# Apps/App R13 Auth UI and Client Boundary Audit

Date: 2026-05-26

Scope: reset app shell and complete Better Auth UI coverage after R12.

## Findings

| ID          | Severity | Finding                                                                                               | Action                                                                                   |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| APP-R13-001 | Low      | `GlobalSidebar` is marked client but owns no hook/event/browser logic.                                | Remove `"use client"` from the wrapper.                                                  |
| APP-R13-002 | Low      | `SidebarFooter` is marked client but owns no hook/event/browser logic.                                | Remove `"use client"` from the footer wrapper; keep `ModeToggle` client.                 |
| APP-R13-003 | Low      | Login and reset forms duplicate password visibility button markup.                                    | Add a route-local reusable password visibility button.                                   |
| APP-R13-004 | Low      | Password visibility text buttons are less consistent with the app design rule favoring icon controls. | Use `Eye` and `EyeOff` icons with `sr-only` accessible text.                             |
| APP-R13-005 | Medium   | Better Auth `signOut` is exported but not exposed in the app shell.                                   | Add a sidebar sign-out action.                                                           |
| APP-R13-006 | Low      | Forgot-password links include `?email=...`, but the forgot-password form ignores the value.           | Parse and prefill a safe email query value in the server page.                           |
| APP-R13-007 | Low      | Verify-email resend does not pass a callback URL.                                                     | Send a same-origin callback URL for consistency with sign-up/sign-in verification flows. |

## Keep

- `NavSection` as client because it uses `usePathname`.
- `NotificationsProvider` as client because it uses `useTheme`.
- Login orchestration inside `use-login-flow`.
- Route-local auth form components under `(unauthenticated)`.
- Better Auth `1.6.11` stable baseline.

## Non-Goals

- Do not redesign the auth pages.
- Do not move auth UI into `@repo/design-system`.
- Do not add product routes.
- Do not change Better Auth server behavior.

## Resolution

- Removed app-owned client directives from sidebar wrapper/footer files.
- Kept real client code in `NavSection`, `SignOutButton`, auth forms, verify/reset content, and provider components.
- Added route-local password visibility UI and reused it in login and reset-password forms.
- Added a sidebar sign-out action using Better Auth `signOut()`.
- Prefilled forgot-password email from the login link query through server-side `searchParams` parsing and a tested route-local helper.
- Added a same-origin callback URL to verify-email resend.

## Validation Results

- `pnpm --filter app typecheck`: passed.
- Targeted ESLint: passed.
- `pnpm test:smoke`: passed, 3 files and 8 tests.
- `pnpm --filter app build`: passed on Next.js `16.2.6`.
- Client-boundary scan: sidebar client files are limited to `nav-section.tsx` and `sign-out-button.tsx`.
- Old-surface scan: no active app route/component references to old Manus/E2B/chat/artifact/project/dashboard/check-email surfaces.
