# Apps/App R16 Alias and Design-System Auth Audit

Date: 2026-05-26

Scope: active auth forms, local app aliases, and design-system primitive usage.

## Findings

| ID          | Severity | Finding                                                                                                                                        | Action                                                                               |
| ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| APP-R16-001 | Low      | `apps/app` and `apps/web` already define `@/*`; R14 documented this but did not use it consistently for app-owned cross-boundary auth imports. | Convert cross-boundary auth imports to `@/…`; keep tight route-local relatives.      |
| APP-R16-002 | Medium   | Auth forms use `Button`, `Input`, and `Label`, but not available `Field`/`FieldError` primitives.                                              | Replace ad hoc error paragraphs with design-system field primitives.                 |
| APP-R16-003 | Medium   | Password visibility button is a raw local button.                                                                                              | Wrap design-system `InputGroupButton` instead.                                       |
| APP-R16-004 | Medium   | Password inputs use absolute overlay markup instead of design-system `InputGroup`.                                                             | Compose password inputs with `InputGroup`, `InputGroupInput`, and `InputGroupAddon`. |
| APP-R16-005 | Low      | Loading icons use direct `Loader2` in auth form buttons.                                                                                       | Prefer design-system `Spinner`.                                                      |

## Keep

- Keep route-owned auth flow folders.
- Keep app-owned `PasswordStrength`, because it is auth-specific validation UI.
- Keep `@repo/design-system` as the UI primitive source until the later restyle.

## Actions Completed

- Converted auth cross-boundary imports to `@/app/(unauthenticated)/...`.
- Kept tight route-local `../_lib` imports where they stay inside a single route folder.
- Replaced ad hoc auth field/error markup with `Field`, `FieldLabel`, `FieldError`, and `FieldDescription`.
- Replaced password overlay markup with `InputGroup`, `InputGroupInput`, `InputGroupAddon`, and a `PasswordVisibilityButton` wrapper over `InputGroupButton`.
- Replaced direct `Loader2` usage with the design-system `Spinner`.
- Replaced login mode raw adjacent buttons with `ToggleGroup` and `ToggleGroupItem`.
- Restored keyboard access to the forgot-password link by removing the route-local `tabIndex={-1}`.

## Validation Results

- `pnpm --filter app typecheck`: passed.
- Targeted ESLint for `apps/app/app/(unauthenticated)` and `apps/app/test/auth-pages.test.ts`: passed.
- `pnpm test:smoke`: passed, 3 files and 12 tests.
- `pnpm --filter app build`: passed on Next.js 16.2.6.
- Raw auth UI scan: no `Loader2`, no raw `<button>`, and no raw red error paragraph pattern.
- Alias scan: no cross-boundary auth `../../_components`, `../../_lib`, or `../../_schemas` imports remain.
- `git diff --check`: passed.
