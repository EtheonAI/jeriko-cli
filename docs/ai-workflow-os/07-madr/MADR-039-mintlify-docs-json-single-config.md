# MADR-039: Use docs.json as the single Mintlify docs config

Status: Accepted

Date: 2026-05-25

## Context

The docs app was upgraded to the current `mint` CLI package. During validation, `pnpm --filter docs lint` generated `apps/docs/docs.json` from the legacy `apps/docs/mint.json` and printed repeated legacy-config warnings before failing on stale starter-template links.

The current Mintlify configuration docs describe `docs.json` as the required central configuration file for navigation, branding, integrations, and API settings. Mintlify's CLI docs also document `mint broken-links` as the internal-link validation command.

## Decision

Use `apps/docs/docs.json` as the only Mintlify configuration file for the docs app.

Delete `apps/docs/mint.json`, update docs content references from `mint.json` to `docs.json`, and replace stale internal Mintlify starter links with current external Mintlify docs URLs.

## Consequences

Positive:

- Removes duplicate config state.
- Stops latest Mintlify CLI legacy-config warnings.
- Keeps docs app aligned with the active `mint@4.2.577` package.
- Makes `pnpm --filter docs lint` a meaningful docs validation gate.

Negative / follow-up:

- Starter docs are still generic Mintlify content, not product docs for AI Workflow OS.
- Public docs content should be replaced later once the product architecture stabilizes.

## Alternatives Considered

- Keep both `mint.json` and `docs.json`: rejected because it creates two sources of truth and preserves legacy warnings.
- Keep only `mint.json`: rejected because the latest CLI auto-migrates to `docs.json`.
- Delete the docs app: rejected by MADR-037; docs is a first-class app surface.

## Evidence

Primary sources checked:

- Mintlify global settings: `https://www.mintlify.com/docs/organize/settings`
- Mintlify CLI commands: `https://www.mintlify.com/docs/cli/commands`
- Mintlify redirects / broken-link guidance: `https://www.mintlify.com/docs/create/redirects`
- Mintlify images and embeds: `https://www.mintlify.com/docs/create/image-embeds`
- Mintlify API playground: `https://www.mintlify.com/docs/api-playground/overview`
- Mintlify analytics integrations: `https://www.mintlify.com/docs/integrations/analytics/overview`
- Mintlify custom domain: `https://www.mintlify.com/docs/customize/custom-domain`

Command evidence:

```bash
pnpm --filter docs lint
```

Observed result after cleanup:

```text
mint broken-links
success no broken links found
```

## Impacted Files

- `apps/docs/docs.json`
- `apps/docs/mint.json`
- `apps/docs/development.mdx`
- `apps/docs/quickstart.mdx`
- `apps/docs/introduction.mdx`
- `apps/docs/essentials/images.mdx`
- `apps/docs/essentials/navigation.mdx`
- `apps/docs/essentials/settings.mdx`
- `apps/docs/README.md`

## Validation Checklist

- [x] Current Mintlify docs checked before the config cleanup.
- [x] Legacy `mint.json` removed.
- [x] Stale `mint.json` text references replaced.
- [x] Broken internal Mintlify starter links replaced.
- [x] `pnpm --filter docs lint` passes.
