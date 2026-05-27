# Design System P1.4 Audit

Date: 2026-05-27

Package: `@repo/design-system`

Scope:

- design-system public exports;
- shadcn/Tailwind/Radix provider surface;
- package dependencies;
- active consumers.

Out of scope:

- redesign/restyling;
- updating every shadcn component from upstream;
- fixing app/web product pages;
- Storybook repair beyond typecheck validation;
- AI/workflow domain UI.

## Current Surface

Exports:

- `.`
- `./components/ui/*`
- `./components/mode-toggle`
- `./components/actions`
- `./components/data-display`
- `./components/feedback`
- `./components/forms`
- `./components/layout`
- `./components/navigation`
- `./components/overlays`
- `./lib/*`
- `./providers/*`
- `./hooks/*`
- `./styles/*`
- `./postcss.config.mjs`

Current consumers:

- `apps/app`
- `apps/web`
- `apps/storybook`
- `@repo/feature-flags`
- internal component imports inside `@repo/design-system`

## Findings

### P1.4-1: Deprecated Toast Stack Remains Beside Sonner

shadcn Tailwind v4 guidance deprecates the old toast component in favor of Sonner. This package already uses `components/ui/sonner` in `DesignSystemProvider`, and active non-doc search found no consumers of `components/ui/toast` or `components/ui/use-toast`.

Decision:

- delete `components/ui/toast.tsx`;
- delete `components/ui/use-toast.ts`;
- remove old toast exports from `components/feedback`;
- remove `@radix-ui/react-toast`.

### P1.4-2: `@radix-ui/react-icons` Is Used Only For Mode Toggle

The package already uses `lucide-react` broadly and shadcn config sets `iconLibrary: "lucide"`.

Decision:

- replace `@radix-ui/react-icons` mode-toggle icons with Lucide icons;
- remove `@radix-ui/react-icons`.

### P1.4-3: `radix-ui` Is Declared As `"latest"`

The current registry latest is `1.4.3`. Package manifests should be reproducible and explicit.

Decision:

- pin `radix-ui` to `1.4.3`.

### P1.4-4: Tailwind v4 Font Tokens Use Runtime Next Font Variables

The design system applies Geist classes on `<html>`, but `@theme inline` should not depend on runtime Next font CSS variables. Use literal Geist names in theme tokens.

Decision:

- change `--font-sans` and `--font-mono` in `styles/globals.css` to literal Geist font stacks.

### P1.4-5: `apps/web` Has Existing Consumer Type Errors

`apps/web` already fails typecheck from:

- old `getTranslations` import;
- old `Calendar initialFocus` prop;
- incomplete `createMetadata` call.

Decision:

- do not patch web in P1.4 unless this package introduces a new failure;
- carry the web failures to the web/i18n/SEO/app cleanup phase.

## Checklist

- [x] shadcn docs checked.
- [x] Tailwind v4 docs checked.
- [x] Vercel shadcn skill checked.
- [x] React best-practice guidance checked.
- [x] latest package registry metadata checked.
- [x] current exports listed.
- [x] current consumers searched.
- [x] server/client/runtime boundary stated.
- [x] keep/refactor verdict written.
- [x] MADR-085 created.
- [x] package playbook updated.
- [x] remove deprecated toast/use-toast and dependency.
- [x] replace Radix icons with Lucide and remove dependency.
- [x] pin `radix-ui`.
- [x] fix Tailwind v4 font tokens.
- [x] run package typecheck.
- [x] run affected consumer typechecks and document blockers.

## Validation Commands

```bash
pnpm --filter @repo/design-system typecheck
pnpm --filter app typecheck
pnpm --filter web typecheck
pnpm --filter storybook typecheck
pnpm --filter @repo/feature-flags typecheck
```

Pre-change validation:

- `@repo/design-system` typecheck passed.
- `pnpm outdated --filter @repo/design-system --format json` returned `{}`.

Post-change validation:

- `pnpm install` completed with pinned pnpm `11.3.0`; lockfile already up to date and husky prepare passed.
- `@repo/design-system` typecheck passed.
- `apps/app` typecheck passed.
- `@repo/feature-flags` typecheck passed.
- `apps/storybook` typecheck passed after a direct story consumer narrowing fix in `apps/storybook/stories/sidebar.stories.tsx`.
- root `pnpm test` passed: 13 files / 45 tests.
- active non-doc search found no direct old toast/use-toast imports.

Known unrelated blocker:

- `apps/web` typecheck still fails on existing contact/i18n/metadata issues:
  - invalid `getTranslations` import from `@repo/internationalization`;
  - old `Calendar initialFocus` prop;
  - missing `description` in `createMetadata` input.

Do not fix these in P1.4.
