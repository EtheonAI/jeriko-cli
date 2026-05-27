# Storybook

## Role

Design-system workshop app for shared UI components.

## Status

Active dev/QA app surface. The `dev` script is currently disabled because of a documented Next 16/SWC compatibility issue; keep the app, but do not let it block product runtime work until that issue is resolved.

## Commands

- `pnpm --filter storybook typecheck`
- `pnpm --filter storybook build`
- `pnpm --filter storybook dev`

## Env

No required runtime env is documented.

## Ownership Rules

- Stories should exercise `packages/design-system` components and reusable shared UI.
- Product route-specific components should not move here unless they become shared design-system primitives.
- Keep Storybook as an app package, not a dependency of product packages.
