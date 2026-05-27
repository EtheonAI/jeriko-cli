# Analytics Package Playbook

Package: `@repo/analytics`

Phase: P5.3

Planned MADR: MADR-105

Status: scheduled; no implementation approved in this phase

## Ownership

Owns:

- optional analytics provider setup;
- client provider wrapper;
- server event helper;
- analytics env validation.

Must not own:

- observability/error capture;
- billing metrics;
- workflow audit events;
- app-specific event naming without a product event contract.

## Current Surface To Audit

Exports:

- `.`
- `./keys`
- `./server`
- `./provider`
- `./instrumentation-client`

Current provider SDKs:

- `@vercel/analytics`
- `posthog-js`
- `posthog-node`
- `@next/third-parties`

## Phase Checklist

- [ ] Check Vercel Analytics, PostHog, and Next third-party docs.
- [ ] Check npm latest and peer requirements.
- [ ] Audit consumers and imported provider SDKs.
- [ ] Decide whether analytics stays optional and disabled without env.
- [ ] Write MADR-105 before code changes if provider/API direction changes.
- [ ] Run `pnpm --filter @repo/analytics typecheck`.

## Initial Verdict

Gate. Keep optional and package-owned; do not let analytics block app builds.
