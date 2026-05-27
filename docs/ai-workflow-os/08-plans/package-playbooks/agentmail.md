# AgentMail Package Playbook

Package: `@repo/agentmail`

Phase: P5.5

Planned MADR: MADR-107

Status: scheduled; no implementation approved in this phase

## Ownership

Owns:

- optional agent-owned inbox/mailbox integration;
- AgentMail SDK boundary;
- package-local AgentMail env validation.

Must not own:

- auth transactional email;
- Resend email templates;
- workflow notification policy;
- generic connector OAuth sessions.

## Current Surface To Audit

Exports:

- `.`
- `./keys`

Current provider SDKs:

- `agentmail`
- `@x402/fetch`

## Phase Checklist

- [ ] Check AgentMail official docs and npm latest.
- [ ] Audit exports, env keys, and app/package consumers.
- [ ] Decide whether this package is kept, gated, or deferred.
- [ ] Confirm it does not overlap with `@repo/email` or `@repo/connectors`.
- [ ] Write MADR-107 before code changes if provider/API direction changes.
- [ ] Run `pnpm --filter @repo/agentmail typecheck`.

## Initial Verdict

Gate. Keep only if agent inboxes are a near-term product requirement.
