# R16 App Alias and Design-System Auth Research

Date researched: 2026-05-26

Scope: `apps/app` auth imports and auth form UI primitives.

## Sources

| Source                                                          | Type                    | Claim checked                                                                                                                             |
| --------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/getting-started/project-structure` | Official Next.js docs   | Route groups organize code without changing URLs; private folders such as `_components` and `_lib` are non-routable colocation folders.   |
| `https://ui.shadcn.com/docs/monorepo`                           | Official shadcn/ui docs | Monorepo apps can import shared UI from a workspace UI package while keeping app-specific components in the app.                          |
| `https://ui.shadcn.com/docs/components/base/input-group`        | Official shadcn/ui docs | `InputGroup` supports input addons, buttons, and helper content; addons should be placed after the input in the DOM for focus management. |
| `https://ui.shadcn.com/docs/components/base/field`              | Official shadcn/ui docs | `Field`, `FieldLabel`, and `FieldError` are intended for consistent field grouping and error presentation.                                |
| `https://ui.shadcn.com/docs/components/base/toggle-group`       | Official shadcn/ui docs | `ToggleGroup` is the appropriate primitive for grouped two-state choices instead of raw adjacent buttons.                                 |
| `https://ui.shadcn.com/docs/components/base/spinner`            | Official shadcn/ui docs | `Spinner` is the design-system loading primitive and can be used inside buttons and input groups.                                         |
| `https://ui.shadcn.com/docs/forms`                              | Official shadcn/ui docs | shadcn/ui is used with form libraries such as React Hook Form; app-owned form logic should compose design-system primitives.              |
| Local `apps/app/tsconfig.json`                                  | Repository source       | `apps/app` already has `@/*` for app-owned imports and `@repo/*` for workspace packages.                                                  |
| Local `apps/web/tsconfig.json`                                  | Repository source       | `apps/web` also has `@/*` and `@repo/*`.                                                                                                  |
| Local `packages/design-system/components/ui`                    | Repository source       | Current design system includes `Field`, `InputGroup`, `Spinner`, `Button`, `Input`, `Label`, and related primitives.                      |

## Findings

- No new local alias is needed for `apps/app` or `apps/web`; both already support `@/*`.
- `@repo/*` should remain the workspace package import lane.
- `@/*` should be used for app-owned cross-boundary imports.
- Short relative imports should remain acceptable inside one route-owned folder because they make colocation obvious.
- Auth forms already use design-system `Button`, `Input`, and `Label`, but can better use `Field`, `FieldError`, `InputGroup`, `InputGroupButton`, `InputGroupInput`, and `Spinner`.
- A local `PasswordVisibilityButton` can stay app-owned only as a tiny semantic wrapper over `InputGroupButton`, because the design system has generic input-group buttons but not a password-field component.
- `PasswordStrength` is app-owned validation UI, but it should use design-system `FieldDescription` for text semantics.

## Implementation Confirmation

- Cross-boundary auth imports now use `@/app/(unauthenticated)/...`; tight route-local imports remain relative.
- Password fields now compose `InputGroup`, `InputGroupInput`, `InputGroupAddon`, and `InputGroupButton`.
- Auth field errors now use `FieldError`.
- Login mode selection now uses `ToggleGroup`.
- Loading states now use `Spinner`.
- The shared rule was added to the canonical engineering standards, operating memory, app playbook, and Next.js component coding-style research: check `@repo/design-system` first, use current primitives before restyling, and keep app wrappers only for route-specific semantics.

## Validation Results

- `pnpm --filter app typecheck`: passed.
- Targeted ESLint: passed.
- `pnpm test:smoke`: passed.
- `pnpm --filter app build`: passed on Next.js 16.2.6.
- Final scans confirmed no raw auth `<button>`, no `Loader2`, no raw red error paragraph pattern, and no auth cross-boundary `../../_components`, `../../_lib`, or `../../_schemas` imports.
- `git diff --check`: passed.
