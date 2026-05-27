# Collaboration Package Playbook

Package: `@repo/collaboration`

Phase: P5.6

Planned MADR: MADR-108

Status: scheduled; no implementation approved in this phase

## Ownership

Owns:

- collaborative editing/session provider boundary;
- Liveblocks auth/config wrappers if retained;
- future `.flow` collaborative editing primitives.

Must not own:

- app shell layout;
- workflow runtime locking;
- notifications;
- user/team auth ownership.

## Current Surface To Audit

Exports:

- `.`
- `./auth`
- `./config`
- `./hooks`
- `./keys`
- `./room`

Current provider SDKs:

- `@liveblocks/client`
- `@liveblocks/node`
- `@liveblocks/react`

## Phase Checklist

- [ ] Check Liveblocks official docs and npm latest.
- [ ] Audit whether current app uses collaboration.
- [ ] Decide keep, gate, or delete until `.flow` editor collaboration exists.
- [ ] Confirm client/server boundaries for hooks, room provider, and auth.
- [ ] Write MADR-108 before code changes if retained or removed.
- [ ] Run `pnpm --filter @repo/collaboration typecheck`.

## Initial Verdict

Gate. Do not let collaboration complexity block the clean app reset.
