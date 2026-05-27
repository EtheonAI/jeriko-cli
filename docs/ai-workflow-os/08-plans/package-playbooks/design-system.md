# Design System Package Playbook

Package: `@repo/design-system`

Date: 2026-05-27

Status: P1.4 active; scoped cleanup approved by MADR-085

Priority: P1 foundation package

## Ownership

What this package owns:

- shared UI primitives copied from shadcn/ui;
- Tailwind/PostCSS design tokens and global styles;
- theme provider;
- toaster/tooltip provider composition;
- UI utility helpers and hooks;
- product-agnostic layout, loading, empty, chart, virtual-list, resizable, sidebar, and form primitives.

What this package must not own:

- auth behavior;
- observability SDK behavior;
- AI SDK tools, AI chat runtime, or platform tool execution;
- AI/workflow message semantics, tool-call/tool-result semantics, or canvas/workbench state;
- connector, sandbox, database, search, storage, payment, CMS, or workflow provider behavior;
- app route handlers;
- route-specific app/web page copy and composition.

## Current Surface

Exports:

- `@repo/design-system`
- `@repo/design-system/components/ui/*`
- `@repo/design-system/components/mode-toggle`
- `@repo/design-system/components/actions`
- `@repo/design-system/components/data-display`
- `@repo/design-system/components/feedback`
- `@repo/design-system/components/forms`
- `@repo/design-system/components/layout`
- `@repo/design-system/components/navigation`
- `@repo/design-system/components/overlays`
- `@repo/design-system/lib/*`
- `@repo/design-system/providers/*`
- `@repo/design-system/hooks/*`
- `@repo/design-system/styles/*`
- `@repo/design-system/postcss.config.mjs`

Provider SDKs:

- UI/rendering libraries only.

Env keys:

- none.

## Sources Checked

| Source                                        | Type              | Checked Date | Claim Used                                                                                                                    |
| --------------------------------------------- | ----------------- | -----------: | ----------------------------------------------------------------------------------------------------------------------------- |
| `https://ui.shadcn.com/docs`                  | Official docs     |   2026-05-27 | shadcn/ui components are copied source owned by the repo.                                                                     |
| `https://ui.shadcn.com/docs/cli`              | Official docs     |   2026-05-27 | Current CLI supports docs/view commands and unified Radix migration.                                                          |
| `https://v3.shadcn.com/docs/tailwind-v4`      | Official docs     |   2026-05-27 | Tailwind v4 guidance uses data-slot attributes, OKLCH tokens, React 19 updates, and deprecates old toast for Sonner.          |
| `https://tailwindcss.com/blog/tailwindcss-v4` | Official docs     |   2026-05-27 | Tailwind v4 is CSS-first and exposes design tokens as CSS variables.                                                          |
| Vercel shadcn skill                           | Local plugin docs |   2026-05-27 | Tailwind v4 `@theme inline` font tokens should use literal Geist font names.                                                  |
| Vercel React best practices                   | Local plugin docs |   2026-05-27 | Keep client dependency surface small and remove stale code.                                                                   |
| Registry metadata                             | npm               |   2026-05-27 | `radix-ui@1.4.3`, `lucide-react@1.16.0`, `sonner@2.0.7`, `react-day-picker@10.0.1`, `next-themes@0.4.6`, `tailwindcss@4.3.0`. |
| Local consumer audit                          | Repo evidence     |   2026-05-27 | No active consumer imports old `toast` or `use-toast`; web has existing Calendar/i18n/metadata errors.                        |

## Local Audit

Commands:

```bash
rg '@repo/design-system' -n --glob '!legacy/**' apps packages
rg 'components/ui/(toast|use-toast)|useToast|ToastProvider|@radix-ui/react-icons|@radix-ui/react-toast' -n --glob '!legacy/**' apps packages
pnpm --filter @repo/design-system typecheck
pnpm outdated --filter @repo/design-system --format json
```

Findings:

- Design-system typecheck passes before cleanup.
- Package dependency freshness reports `{}` before cleanup.
- Old shadcn toast stack is unused and deprecated in current shadcn Tailwind v4 guidance.
- `@radix-ui/react-icons` is used only in `ModeToggle`; Lucide is already the configured icon library.
- `radix-ui` should be pinned rather than declared as `"latest"`.
- `apps/web` has pre-existing type errors unrelated to design-system package internals.

## Decision

Verdict: refactor.

Reason:

- Design system must stay primitive-only.
- Deprecated and unused UI surface should be removed.
- Package manifest should not use `"latest"`.
- Tailwind v4 tokens should not depend on runtime font variables.

## Refactor Checklist

- [x] Public exports are intentional.
- [x] No provider SDK initialization in this package.
- [x] Latest registry metadata checked.
- [x] Current consumers searched.
- [x] MADR-085 created.
- [x] Remove deprecated `toast.tsx` and `use-toast.ts`.
- [x] Remove old toast exports from `components/feedback`.
- [x] Replace Radix icons in `ModeToggle` with Lucide icons.
- [x] Remove `@radix-ui/react-icons` and `@radix-ui/react-toast`.
- [x] Pin `radix-ui` to `1.4.3`.
- [x] Change Tailwind `@theme inline` font tokens to literal Geist font names.
- [x] Run `pnpm --filter @repo/design-system typecheck`.
- [x] Run affected consumer typechecks and document blockers.

## Validation

```bash
pnpm --filter @repo/design-system typecheck
pnpm --filter app typecheck
pnpm --filter web typecheck
pnpm --filter storybook typecheck
pnpm --filter @repo/feature-flags typecheck
```

Latest validation:

- Pre-change `@repo/design-system` typecheck passed.
- Pre-change package freshness returned `{}`.
- Post-change `@repo/design-system` typecheck passed.
- `apps/app` typecheck passed.
- `@repo/feature-flags` typecheck passed.
- `apps/storybook` typecheck passed after a sidebar story type-narrowing fix.
- `apps/web` typecheck still fails on existing contact/i18n/metadata issues.
- Root `pnpm test` passed: 13 files, 45 tests.

## Open Risks

- shadcn component refresh should be a separate visual/system phase using current CLI docs/view/diff output, not mixed into package boundary cleanup.
- `apps/web` still needs route/i18n/SEO fixes.
- React Day Picker v10 no longer accepts the old `initialFocus` prop; the active `apps/web` contact consumer was updated to `autoFocus` in P3.3A instead of reintroducing the old API in the shared Calendar wrapper.
- The unified `radix-ui` package may still include `@radix-ui/react-toast` transitively in the lockfile; the direct dependency and direct imports were removed.
