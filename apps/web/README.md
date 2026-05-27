# Web

## Role

Marketing and content site for AI Workflow OS.

## Status

Active app surface. Keep it separate from `apps/app`; fix CMS/env/build ownership instead of deleting or merging it.

## Commands

- `pnpm --filter web dev`
- `pnpm --filter web typecheck`
- `pnpm --filter web build`

## Env

Uses T3 Env through the app/package env composition.

Current CMS status: `apps/web` is BaseHub-free. It uses a temporary local content facade while CMS is deferred. Do not add a new CMS during cleanup; evaluate Payload or static content after the product app is clean.

Feature flags remain active through `@repo/feature-flags` and T3 Env. Marketing builds must not require product database env just to load feature-flag metadata.

## Ownership Rules

- Keep product runtime code out of `apps/web`.
- Import only safe shared packages such as design system, SEO, analytics, internationalization, and the intentionally selected CMS/content package.
- Route-local marketing components should live near their routes.
