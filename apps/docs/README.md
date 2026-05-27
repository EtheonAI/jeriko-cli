# Docs

## Role

Documentation app/content surface for product and developer docs.

## Status

Active app surface. It is not the product runtime, but it remains a first-class app package in the monorepo.

## Commands

- `pnpm --filter docs dev`
- `pnpm --filter docs lint`
- `pnpm build:docs`

## Env

No required runtime env is documented yet. Mintlify publishing credentials, if needed, must be documented before CI/deploy usage.

## Package Rule

Use the current `mint` CLI package, not the legacy `mintlify` package. Official Mintlify docs and CLI references use `mint`, and the active workspace has validated `mint@4.2.577`.

`apps/docs` pins `react` and `react-dom` to the same workspace versions as the other app surfaces. Mintlify's internal MDX packages still declare React 18 peer ranges, so the root pnpm peer policy documents that compatibility exception while keeping a single React 19 family in the lockfile.

The docs app uses `docs.json` as the single Mintlify configuration file. Do not reintroduce `mint.json`.

## Ownership Rules

- Keep source docs in this app or in `docs/ai-workflow-os` depending on audience.
- Product architecture decisions stay in `docs/ai-workflow-os`.
- Public documentation content can move here when the product docs surface is intentionally restored.
