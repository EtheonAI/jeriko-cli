# Notifications Package Playbook

Package: `@repo/notifications`

Phase: P4.7

Planned MADR: MADR-102

Status: scheduled; no implementation approved in this phase

## Ownership

Owns:

- notification provider boundary;
- notification React provider if retained;
- future workflow approval, issue, digest, and alert delivery primitives.

Must not own:

- auth email;
- analytics events;
- workflow state machine;
- app-specific toast UI.

## Current Surface To Audit

Exports:

- `.`
- `./keys`
- `./provider`

Current provider SDKs:

- `@knocklabs/node`
- `@knocklabs/react`

## Phase Checklist

- [ ] Check Knock official docs and npm latest.
- [ ] Audit consumers and whether notifications are currently used.
- [ ] Decide keep, gate, or defer until workflow approvals are implemented.
- [ ] Confirm provider remains optional without env during app build.
- [ ] Write MADR-102 before code changes if retained or removed.
- [ ] Run `pnpm --filter @repo/notifications typecheck`.

## Initial Verdict

Gate. Needed later for workflow approvals/digests, not required for app reset.
