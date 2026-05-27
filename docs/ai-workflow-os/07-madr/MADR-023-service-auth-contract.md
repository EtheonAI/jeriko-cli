# MADR-023: Verified Service Auth Contract

Date: 2026-05-23

Status: Proposed

## Context

Protected services use `x-user-id` as caller identity after gateway verification, but enforcement is inconsistent. Some services enforce `x-gateway-secret` only if an env var exists. Orchestrator often calls services with `x-user-id` only and does not install the shared service auth hook.

Autonomous workflows will call tools, sandboxes, deployments, media, connectors, and billing paths. Body-provided identity is not acceptable for that runtime.

## Decision

All protected service calls outside local development must use verified service auth.

Rules:

- `GATEWAY_SECRET` is required in staging and production.
- Protected services reject missing or invalid gateway secret.
- User identity is derived from verified gateway context.
- Body `userId` is treated as data only, never authority.
- Service-to-service calls use one shared authenticated client.

## Consequences

Positive:

- Resource ownership checks become meaningful.
- Spoofed direct service calls fail.
- Workflow execution has a consistent identity model.

Negative:

- Some current orchestrator calls will break until migrated.
- Local development needs an explicit bypass or local secret setup.

## Acceptance Criteria

- Protected routes fail without gateway secret in production mode.
- Orchestrator uses shared service client.
- Cross-user ownership regression tests pass.
- API routes no longer forward body-provided `userId` as authority.
