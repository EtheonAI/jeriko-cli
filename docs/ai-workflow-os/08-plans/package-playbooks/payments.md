# Payments Package Playbook

Package: `@repo/payments`

Phase: P5.1

Planned MADR: MADR-103

Status: scheduled; no implementation approved in this phase

## Ownership

Owns:

- Stripe SDK boundary;
- billing/customer/subscription helpers;
- future usage metering contract;
- payment env validation.

Must not own:

- workflow credit policy before product pricing is decided;
- webhook routing ownership without `@repo/webhooks`;
- app billing UI.

## Current Surface To Audit

Exports:

- `.`
- `./keys`

Current provider SDKs:

- `stripe`

## Phase Checklist

- [ ] Check Stripe official docs, npm latest, peer/runtime requirements, and API version guidance.
- [ ] Audit whether any Stripe API version was downgraded.
- [ ] Decide billing API surface and usage metering boundary.
- [ ] Confirm provider SDK stays package-owned.
- [ ] Write MADR-103 before code changes.
- [ ] Run `pnpm --filter @repo/payments typecheck`.

## Initial Verdict

Keep gated. Payments are important, but not a blocker for the clean app foundation.
