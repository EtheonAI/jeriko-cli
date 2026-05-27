# Webhooks Package Playbook

Package: `@repo/webhooks`

Phase: P5.4

Planned MADR: MADR-106

Status: scheduled; no implementation approved in this phase

## Ownership

Owns:

- inbound/outbound webhook provider helpers;
- Svix SDK boundary if retained;
- webhook env validation;
- future workflow trigger delivery helpers.

Must not own:

- app route handler implementation;
- auth core logic;
- workflow runtime state machine;
- connector OAuth callbacks.

## Current Surface To Audit

Exports:

- `.`
- `./keys`

Current provider SDKs:

- `svix`

Current internal deps:

- `@repo/auth`

## Phase Checklist

- [ ] Check Svix official docs and npm latest.
- [ ] Audit current app/webhook consumers.
- [ ] Decide whether webhook signing helpers are generic enough for package ownership.
- [ ] Confirm auth dependency is intentional and does not create cycles.
- [ ] Write MADR-106 before code changes if provider/API direction changes.
- [ ] Run `pnpm --filter @repo/webhooks typecheck`.

## Initial Verdict

Keep gated. Webhooks become important for workflow triggers, but should stay narrow.
