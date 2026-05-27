# Apps/App R19 Dependency Boundary Audit

Date: 2026-05-26

Scope: `apps/app/package.json` direct dependency ownership after R18.

## Current Direct Dependencies

`apps/app/package.json` includes:

- workspace packages for analytics, auth, database, design-system, email, feature-flags, next-config, notifications, observability, payments, and security;
- Next/React family;
- auth form helpers: `@hookform/resolvers`, `react-hook-form`, `zod`;
- app UI helpers: `lucide-react`, `next-themes`, `sonner`;
- server/runtime helpers: `server-only`;
- compiler/style tooling: `babel-plugin-react-compiler`, Tailwind PostCSS packages;
- `motion`.

## Findings

| Dependency                    | Current state                                                                       | Decision                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `better-auth`                 | Directly imported by `apps/app` before R19, bypassing `@repo/auth`.                 | Move app imports behind `@repo/auth/next`; do not add to app package. |
| `motion`                      | Declared by `apps/app`, not imported by active app code.                            | Remove.                                                               |
| `babel-plugin-react-compiler` | Not imported directly, but required by Next compiler config and Next peer metadata. | Keep.                                                                 |
| `@repo/email`                 | Imported by `env.ts` key contract and used indirectly by auth package.              | Keep.                                                                 |
| `@repo/payments`              | Imported by `env.ts` key contract.                                                  | Keep.                                                                 |
| `@repo/notifications`         | Imported by authenticated shell notification provider and env.                      | Keep.                                                                 |
| `@hookform/resolvers`         | Directly imported by auth forms.                                                    | Keep.                                                                 |
| `react-hook-form`             | Directly imported by auth forms.                                                    | Keep.                                                                 |
| `zod`                         | Directly imported by app env and auth schemas.                                      | Keep.                                                                 |
| `next-themes`                 | Directly imported by authenticated notifications provider.                          | Keep.                                                                 |
| `sonner`                      | Directly imported by auth/sign-out UI.                                              | Keep.                                                                 |
| `server-only`                 | Directly imported by DAL.                                                           | Keep.                                                                 |

## Keep

- Central T3 Env package composition dependencies.
- `better-auth` only in `@repo/auth`; app imports Next auth helpers from `@repo/auth/next`.
- React Compiler peer dependency.

## Delete / Gate

- Delete only `motion` from `apps/app`.
- Do not add `better-auth` to `apps/app`; expose app-facing helpers from `@repo/auth`.
- Do not delete workspace package dependencies just because they are env-only.
- Do not alter root `publicHoistPattern` in this phase.

## Honest Limits

- This audit covers `apps/app` direct dependency ownership only.
- This is not a whole-repo dependency dedupe.
- This is not a full lockfile minimization pass.
- This is not a public-hoist-pattern audit.
