# MADR-092: Retire BaseHub CMS And Defer Payload Install

Date: 2026-05-27

Status: accepted

Package: `@repo/cms`

## Context

The active `@repo/cms` package is BaseHub-specific. It exports BaseHub query helpers, generated BaseHub types, BaseHub component wrappers, BaseHub env keys, and BaseHub codegen scripts.

The local audit found that no active app or package imports `@repo/cms`. `apps/web` no longer declares `@repo/cms`; it uses a local temporary content facade. The package is therefore preserving stale provider-specific implementation without active value.

Payload is the likely future CMS. Current Payload docs and npm metadata confirm compatibility with Node 22 and Next `16.2.6`, but the installation is not only a package dependency change. Payload requires app-router files, `withPayload`, `payload.config.ts`, a database adapter, a secret, media/storage decisions, and admin/auth decisions.

## Decision

Retire BaseHub from the active `@repo/cms` package now.

Keep `@repo/cms` as a provider-neutral content boundary with typed content contracts and an inert `withCMS` config hook.

Do not install Payload in P3.1. Adopt Payload in a later explicit CMS implementation phase after deciding placement, DB/schema, auth/admin, storage, preview, and localization.

## Consequences

Positive:

- Removes stale BaseHub provider code and generated type surface from the active package graph.
- Prevents future builds from reintroducing BaseHub codegen/token coupling.
- Keeps a clean package boundary ready for Payload.
- Avoids a blind Payload install before app placement and data/auth/storage decisions.

Negative:

- Marketing CMS functionality remains empty/minimal until the Payload phase.
- Future Payload adoption still needs a dedicated app/package integration phase.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p3-1-cms-payload-basehub-research.md`
- `docs/ai-workflow-os/10-audit/cms-p3-1-audit-2026-05-27.md`
- https://payloadcms.com/docs/getting-started/installation
- https://payloadcms.com/docs/local-api/overview
- https://payloadcms.com/docs/database/postgres
- https://docs.basehub.com/llms-full

## Checklist

- [x] Package playbook updated.
- [x] BaseHub dependency removed.
- [x] BaseHub env/script/codegen/types/component wrappers removed.
- [x] Provider-neutral content contract added.
- [x] Package tests added.
- [x] CMS typecheck passes.
- [x] CMS tests pass.
- [x] Root tests pass.
- [x] Payload adoption remains documented but not installed.

## Validation Notes

- `pnpm --filter @repo/cms typecheck` passed.
- `pnpm --filter @repo/cms test` passed: 1 file / 2 tests.
- `pnpm test` passed: 18 files / 60 tests.
- `pnpm --filter web typecheck` remains blocked by existing contact/i18n/calendar/metadata issues outside P3.1.
