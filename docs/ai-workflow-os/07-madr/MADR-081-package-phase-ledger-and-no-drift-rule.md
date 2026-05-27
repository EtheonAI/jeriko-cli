# MADR-081: Package Phase Ledger And No-Drift Rule

Status: Accepted

Date: 2026-05-27

## Context

The workspace has 26 active `packages/*` packages plus multiple app surfaces. The reset has already shown the risk of chasing lint/build errors across unrelated areas: broad edits can cross ownership boundaries, break the plan, and hide whether a package was actually audited.

The user direction is explicit:

- no blind patching;
- no jumping package boundaries;
- research latest docs and registry data before package changes;
- document the package phase before code changes;
- keep package behavior in packages, then consume from apps;
- move step by step.

## Decision

All future package cleanup will use a package phase ledger.

No package implementation changes may start until the package has:

1. official docs / llms.txt / registry metadata checked;
2. local package audit completed;
3. package playbook updated;
4. central MADR or package-phase decision recorded when architecture/provider/API direction changes;
5. checklist written;
6. validation commands selected.

During a package phase, only the active package and directly required consumers may be edited.

If an error appears in another package, it is documented as a later phase unless it blocks the active package validation.

## Package Phase Order

The canonical phase order lives in:

- [`../08-plans/package-phase-roadmap-2026-05-27.md`](../08-plans/package-phase-roadmap-2026-05-27.md)

The first phases are:

1. R21 tests cleanup.
2. P1 foundation config/test packages: `@repo/typescript-config`, `@repo/next-config`, `@repo/testing`.
3. P2 auth/data/communication/security packages: `@repo/auth`, `@repo/database`, `@repo/email`, `@repo/security`, env-adjacent packages.
4. P3 CMS and internationalization: `@repo/cms` to evaluate Payload, `@repo/internationalization` to evaluate `next-intl`.
5. P4 workflow platform packages: `@repo/ai`, `@repo/flow`, `@repo/sandbox`, `@repo/connectors`, `@repo/search`, `@repo/storage`, `@repo/notifications`.
6. P5 remaining web/product operations packages.
7. P6 app rebuilds.

## Evidence

Primary docs checked while setting this rule:

- Payload docs: Payload is code-first, version controlled, has Admin UI, REST/GraphQL/Node APIs, access control, file/media support, live preview, migrations, and can install into an existing Next.js app.
- Payload installation docs: current package set is `payload`, `@payloadcms/next`, and a DB adapter such as `@payloadcms/db-postgres`; registry latest checked as `3.85.0` for all three.
- `next-intl` routing setup docs: App Router setup uses `defineRouting`, `proxy.ts`, `createNavigation`, request config, `[locale]` layout, and static rendering helpers; registry latest checked as `4.12.0`.
- Turborepo internal package docs: internal packages are workspace packages consumed like external packages; apps should consume public package APIs rather than package internals.
- Next.js App Router docs: App Router uses React Server Components, Suspense, and Server Functions; app structure should remain route/file-convention driven.

## Consequences

Positive:

- prevents cross-package drift;
- creates proof before package rewrites;
- keeps apps consuming package APIs;
- makes CMS/Payload and next-intl decisions explicit instead of accidental.

Negative:

- slower than fixing visible errors directly;
- some root lint/build failures will remain until their owning package phase.

## Validation Checklist

- [x] R21 tests cleanup documented.
- [x] Root test runner changed to include app tests.
- [x] Root `pnpm test` passed after R21.
- [x] App `pnpm test:smoke` passed after R21.
- [x] Package phase roadmap created.
- [ ] Package playbooks updated package by package during each phase.
- [ ] Each future package phase creates/updates its MADR before implementation.
