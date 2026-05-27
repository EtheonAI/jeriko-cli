# MADR-085: Keep Design System Primitive-Only And Remove Deprecated Toast Stack

Status: Accepted

Date: 2026-05-27

## Context

`@repo/design-system` is a foundation package used by `apps/app`, `apps/web`, `apps/storybook`, and `@repo/feature-flags`. It should own reusable UI primitives, tokens, CSS, hooks, fonts, and provider composition, not product-specific workflow UI.

The package already uses Sonner as the app-level toaster, but still exports the deprecated shadcn toast implementation and keeps `@radix-ui/react-toast`. It also imports Radix icons only for `ModeToggle`, despite the package being configured for Lucide icons. `radix-ui` is declared as `"latest"` instead of an exact current version.

## Decision

In P1.4:

- keep `@repo/design-system` as the primitive/token/provider package;
- remove deprecated `toast.tsx` and `use-toast.ts`;
- remove `@radix-ui/react-toast`;
- replace `@radix-ui/react-icons` usage with Lucide icons and remove the dependency;
- pin `radix-ui` to the checked latest version `1.4.3`;
- update Tailwind v4 font tokens to literal Geist font families.

Do not redesign UI or update every shadcn component in this phase.

Do not patch existing `apps/web` contact/i18n/metadata errors inside this package phase.

## Evidence

- shadcn docs define components as copied source owned by the repo.
- shadcn CLI docs support unified `radix-ui` migration and current component source workflows.
- shadcn Tailwind v4 docs say components support React 19/Tailwind v4, use data-slot attributes, OKLCH tokens, and deprecate old toast in favor of Sonner.
- Tailwind v4 docs use CSS-first theme tokens.
- Vercel shadcn guidance warns `@theme inline` font declarations should use literal Geist font family names, not runtime Next font variables.
- Registry checks on 2026-05-27 show current package versions: `radix-ui@1.4.3`, `lucide-react@1.16.0`, `sonner@2.0.7`, `react-day-picker@10.0.1`, `next-themes@0.4.6`, `tailwindcss@4.3.0`.
- Local consumer search found no active consumers of `components/ui/toast` or `components/ui/use-toast`.

## Consequences

Positive:

- removes deprecated UI surface;
- reduces direct dependencies;
- makes the package manifest deterministic;
- keeps design system ownership focused;
- aligns tokens with Tailwind v4 guidance.

Negative:

- old toast API will no longer be available if future code tries to import it;
- `apps/web` remains failing until its own route/i18n/SEO cleanup phase.

## Impacted Files

- `packages/design-system/components/mode-toggle.tsx`
- `packages/design-system/components/feedback/index.ts`
- `packages/design-system/components/ui/toast.tsx`
- `packages/design-system/components/ui/use-toast.ts`
- `packages/design-system/package.json`
- `packages/design-system/styles/globals.css`
- `apps/storybook/stories/sidebar.stories.tsx`
- `pnpm-lock.yaml`

## Validation Checklist

- [x] Official docs checked.
- [x] Registry metadata checked.
- [x] Consumers searched.
- [x] Package playbook updated.
- [x] Deprecated toast stack removed.
- [x] Dependencies trimmed/pinned.
- [x] `@repo/design-system` typecheck passes.
- [x] affected consumers typecheck or blockers are documented.
