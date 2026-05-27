# MADR-089: Security Package Provider Boundary And Tests

Date: 2026-05-27

Status: accepted

Package: `@repo/security`

## Context

`@repo/security` owns Arcjet runtime security and Nosecone security headers. Apps consume the package through `secure()` and `@repo/security/middleware`.

The package dependencies are current. The local audit found no direct app source imports of Arcjet or Nosecone, but `apps/web/package.json` still declares `@arcjet/next` directly. That weakens provider ownership and can invite future direct app imports.

The package also lacks package-local tests for its intentional skip behavior. Since `ARCJET_KEY` is optional, `secure()` must be inert without credentials and during development.

## Decision

Keep `@repo/security` as the only active Arcjet/Nosecone provider owner.

Remove the unused direct `@arcjet/next` dependency from `apps/web`.

Add package-local tests for:

- no `ARCJET_KEY` means no provider call;
- development mode means no provider call even when a key exists.

Do not add `server-only` to `@repo/security` in P2.4 because the package is consumed from Next proxy/middleware.

## Consequences

Positive:

- Provider SDK ownership stays in the shared package.
- Apps continue consuming the security abstraction.
- Skip behavior is tested and protected.

Negative:

- Route-specific Arcjet policies remain future work.
- CSP remains disabled by default until provider/media/sandbox needs are finalized.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p2-4-security-arcjet-nosecone-research.md`
- `docs/ai-workflow-os/10-audit/security-p2-4-audit-2026-05-27.md`
- https://docs.arcjet.com/
- https://docs.arcjet.com/bot-protection
- https://docs.arcjet.com/shield
- https://docs.arcjet.com/nosecone/quick-start
- https://www.next-forge.com/packages/security/headers

## Checklist

- [x] Package playbook updated.
- [x] Unused app-level Arcjet dependency removed.
- [x] Security package tests added.
- [x] Security package typecheck passes.
- [x] Security package tests pass.
- [x] Root tests pass.

## Validation Notes

- `@repo/security` typecheck and tests passed.
- `apps/app` typecheck passed.
- root `pnpm test` passed with 15 files / 52 tests.
- `apps/web` typecheck remains blocked by existing contact/i18n/calendar/metadata issues outside P2.4.
