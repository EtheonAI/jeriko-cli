# MADR-065: Package-By-Package Modernization Gate

Status: Accepted

Date: 2026-05-26

## Context

The active workspace now has 26 active `packages/*` packages. Package typecheck passes, but the dependency graph still has 18 circular dependency errors in `@repo/ai` and `@repo/database`.

The user direction is explicit:

- audit every package;
- check latest official docs and registry metadata before changing a package;
- write/update a playbook and MADR/checklist before refactor;
- upgrade dependencies to latest compatible releases;
- fix package code to senior package boundaries;
- validate each package before moving on;
- replace the CMS direction with Payload when the CMS package phase starts.

## Decision

Modernize packages in phases instead of making broad app-level patches.

Each package phase must follow this gate:

```text
audit local package
-> check official docs / llms.txt when available
-> check registry latest metadata
-> update playbook and checklist
-> add MADR when architecture/provider/API direction changes
-> refactor package-owned code
-> run package validation
-> run graph validation
-> move to the next package
```

P0 remains graph health:

1. fix `@repo/ai` renderer registry cycles;
2. fix `@repo/database` schema cycles;
3. make `pnpm boundaries:cruise` pass.

Only after P0 should deeper P1/P2 package modernization start.

## Consequences

Positive:

- app rebuild happens on package-owned APIs instead of app-local provider drift;
- graph health becomes a real gate, not a note;
- package upgrades are tied to registry evidence;
- Payload CMS migration is contained to the CMS phase.

Negative:

- slower than patching individual app errors;
- requires more documentation before each package change;
- full workspace build will remain blocked until P0 graph cycles are fixed.

## Evidence

- `pnpm outdated -r` on 2026-05-26 reported only seven currently stale dependencies: `chromatic`, `posthog-js`, `posthog-node`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@sentry/nextjs`, and `react-email`.
- `pnpm --filter "./packages/*" typecheck` passes across 26 active packages.
- `pnpm boundaries:cruise` fails on 18 existing cycles in `@repo/ai` and `@repo/database`.
- Turborepo docs define apps as deployable graph endpoints and packages as reusable library/config packages.
- Dependency-cruiser docs support forbidden dependency rules as graph gates.

## Validation Checklist

- [x] Current package modernization gate documented.
- [x] Current stale dependency list recorded from registry-backed tooling.
- [x] P0 graph health identified as the immediate blocker.
- [ ] Fix `@repo/ai` renderer cycles.
- [ ] Fix `@repo/database` schema cycles.
- [ ] Make `pnpm boundaries:cruise` pass.
- [ ] Upgrade stale dependencies in their package phases.
- [ ] Add Payload CMS MADR during `@repo/cms` phase before installing or migrating Payload.
