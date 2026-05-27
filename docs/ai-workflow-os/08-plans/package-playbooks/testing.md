# Testing Package Playbook

Package: `@repo/testing`

Phase: P1.3

Planned MADR: MADR-084

Status: P1.3 active; reset approved by MADR-084

## Ownership

Owns:

- shared Vitest config helpers;
- future shared test helpers only after two or more active consumers need them.

Must not own:

- deleted Manus/service fixtures;
- app-specific test assertions;
- integration tests that belong in apps;
- stale tRPC helpers;
- stale MSW handlers for deleted app/API flows;
- package implementation logic.

## Current Surface

Target exports after P1.3:

- `.`

Current stale exports scheduled for removal:

- `./setup`
- `./factories`
- `./db`
- `./db/seed`
- `./helpers/trpc-caller`
- `./msw`
- `./msw/browser`

Current dependencies to trim:

- `@faker-js/faker`
- `msw`
- `react`
- `react-dom`

## Sources Checked

| Source                                    | Type          | Checked Date | Claim Used                                                                                                              |
| ----------------------------------------- | ------------- | -----------: | ----------------------------------------------------------------------------------------------------------------------- |
| `https://vitest.dev/config/projects`      | Official docs |   2026-05-27 | Vitest supports project configuration for monorepos.                                                                    |
| `https://vitest.dev/guide/projects`       | Official docs |   2026-05-27 | Vitest `workspace` terminology is replaced by `projects`; root config does not automatically apply all project options. |
| `https://mswjs.io/docs/integrations/node` | Official docs |   2026-05-27 | MSW Node setup needs explicit active handlers.                                                                          |
| `https://fakerjs.dev/guide/`              | Official docs |   2026-05-27 | Generated data helpers should match current domain models.                                                              |
| Registry metadata                         | npm           |   2026-05-27 | `vitest@4.1.7`, `vite@8.0.14`, `msw@2.14.6`, `@faker-js/faker@10.4.0`.                                                  |
| Local consumer audit                      | Repo evidence |   2026-05-27 | No active non-doc consumers import `@repo/testing`.                                                                     |

## Phase Checklist

- [x] Check Vitest, Vite, MSW, and Faker docs/latest versions.
- [x] Audit all consumers of `@repo/testing`.
- [x] Decide stale helpers should be deleted because no active consumers exist.
- [x] Write MADR-084 before changing exported testing API.
- [x] Remove stale files/exports/dependencies.
- [x] Run `pnpm --filter @repo/testing typecheck`.
- [x] Run root `pnpm test` after shared testing changes.

## Final Verdict

Keep/refactor. Reset to shared Vitest config only.

Validation:

- `@repo/testing` typecheck passed.
- Root `pnpm test` passed: 13 files, 45 tests.
