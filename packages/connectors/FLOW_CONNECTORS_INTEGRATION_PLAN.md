# `@repo/connectors` `.flow` Integration Plan

Date: 2026-05-27

Status: pending runtime wiring phase.

## Role

`@repo/connectors` owns Composio/direct provider connectivity, sessions, connected accounts, toolkits, raw action execution, triggers, and event normalization.

It does not own platform permission policy. Workflow-visible execution must be wrapped by `@repo/ai/tools`.

## Current State

Implemented:

- provider-neutral connector contracts;
- Composio adapter;
- direct adapter boundary;
- mock adapter;
- trigger/event contracts.

Missing for `.flow`:

- persisted session/connection mapping to workflow/run;
- connector trigger to ECP ingestion path;
- platform tool manifest registry integration;
- production idempotency/audit/billing writes;
- approval request integration.

## Build Checklist

- [ ] Map `.flow` tool IDs to platform tool manifests.
- [ ] Store connected account references by org/user/workflow.
- [ ] Store connector session references when reusable.
- [ ] Normalize connector trigger payloads to ECP.
- [ ] Route connector events to runtime event router.
- [ ] Execute raw actions only through `@repo/ai/tools`.
- [ ] Persist provider log IDs and raw metadata safely.
- [ ] Add tests for missing connection, expired auth, approval required, and trigger normalization.
