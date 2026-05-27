# MADR-066: Latest Dependency Refresh With Docs Gate

Status: Accepted

Date: 2026-05-26

## Context

The user requires latest package releases, with current docs checked before package changes. After P0 graph health was fixed, `pnpm outdated -r` showed a small set of stale package versions.

## Decision

Apply the current latest patch/minor dependency refresh only after checking official docs for each affected package family:

- Sentry Next.js for `@repo/observability` and `apps/web`;
- React Email for `@repo/email` and `apps/email`;
- AWS SDK for JavaScript v3 S3 for `@repo/storage`;
- PostHog JS and Node docs for `@repo/analytics`;
- Chromatic docs for `apps/storybook`.

Use `pnpm update -r ... --latest` only for dependencies identified by `pnpm outdated -r`.

## Consequences

Positive:

- workspace package manifests now match latest registry output;
- docs evidence is recorded before upgrade;
- package behavior is not refactored during a version-only refresh.

Negative:

- version refresh does not replace deeper package audits;
- affected packages still need full package playbooks before architecture changes.

## Evidence

- Research: [`../09-research/2026-05-26-latest-dependency-refresh.md`](../09-research/2026-05-26-latest-dependency-refresh.md)
- After update, `pnpm outdated -r` produced no outdated dependency output.
- Affected typechecks passed for `@repo/observability`, `@repo/email`, `@repo/storage`, `@repo/analytics`, and `storybook`.

## Validation Checklist

- [x] Official docs checked for each dependency family.
- [x] Registry-backed outdated list recorded.
- [x] Dependencies updated to latest listed releases.
- [x] Affected package/app typechecks passed.
- [x] Run full package typecheck after refresh.
- [x] Run app/web typecheck after refresh.
- [ ] Run final build gates after package phases.
