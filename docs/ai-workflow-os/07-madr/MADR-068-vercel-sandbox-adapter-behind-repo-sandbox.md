# MADR-068: Put Vercel Sandbox Behind `@repo/sandbox`

Date: 2026-05-26

Status: Accepted

## Context

AI Workflow OS needs isolated command execution for generated code, validation scripts, file operations, previews, and future browser automation. The old project used E2B-shaped services and UI hooks, but the reset architecture already decided that provider SDKs must not leak into apps or `@repo/flow`.

Vercel Sandbox is the target provider, but it should be implemented as an adapter behind `@repo/sandbox`, not imported directly in app routes or workflow compiler packages.

## Sources Checked

| Source                                                                                                          | Type                           | Checked Date | Evidence Used                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------ | -----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://vercel.com/docs/vercel-sandbox                                                                          | Official docs                  |   2026-05-26 | Vercel Sandbox is for safely running untrusted/user-generated code in ephemeral Linux VMs.                                                                      |
| https://vercel.com/docs/vercel-sandbox/sdk-reference                                                            | Official SDK docs              |   2026-05-26 | SDK supports `Sandbox.create`, `runCommand`, `readFileToBuffer`, `writeFiles`, `domain`, `stop`, OIDC auth, runtimes, ports, env, timeouts, and network policy. |
| https://vercel.com/docs/llms-full.txt                                                                           | Official machine-readable docs |   2026-05-26 | Confirms authentication, runtime, timeout, resource, and pricing/limits notes for sandbox work.                                                                 |
| `pnpm view @vercel/sandbox version engines peerDependencies dependencies --registry https://registry.npmjs.org` | Registry metadata              |   2026-05-26 | Latest `@vercel/sandbox` is `2.0.0`; no peer dependency conflict surfaced.                                                                                      |
| `packages/sandbox/node_modules/@vercel/sandbox/dist/*.d.ts`                                                     | Installed SDK types            |   2026-05-26 | Current SDK type shape uses `Sandbox.create`, `Sandbox.get({ name })`, `writeFiles`, `readFileToBuffer`, and `domain(port)`.                                    |

## Decision

Implement a Vercel Sandbox adapter inside `@repo/sandbox` and expose it through a dedicated subpath, while keeping the default package contract provider-neutral.

Add:

- `@repo/sandbox/vercel` for the real provider adapter;
- `@repo/sandbox/mock` for tests and future workflow unit tests;
- `@repo/sandbox/keys` for package-local T3 Env parsing of optional Vercel credentials;
- contract fields for ports, env, network policy, resources, session lookup, and port URL resolution.

Apps, `@repo/flow`, and unrelated packages must continue to be blocked from importing `@vercel/sandbox` directly.

## Consequences

Positive:

- The app can later use sandbox capabilities through package APIs, not provider SDKs.
- `@repo/flow` can plan sandbox work without pulling Vercel runtime dependencies.
- E2B deletion/migration can happen against a stable internal interface.
- Tests can use a mock adapter without creating real microVMs.

Tradeoffs:

- Real sandbox integration tests require Vercel project auth and should stay opt-in.
- Browser automation/snapshot setup is intentionally deferred; it belongs in a later adapter capability phase.
- Durable artifact persistence remains separate from sandbox execution and must go through storage/artifacts design.

## Checklist

- [x] Verify latest official Vercel Sandbox docs.
- [x] Verify latest `@vercel/sandbox` registry metadata.
- [x] Keep provider SDK imports isolated in `@repo/sandbox`.
- [x] Add provider-neutral contract expansion.
- [x] Add Vercel adapter subpath.
- [x] Add mock adapter subpath.
- [x] Add package-local env keys.
- [x] Validate package typecheck.
- [x] Validate package tests.
- [x] Validate full active package typecheck.
- [x] Validate app/web typechecks.
- [x] Validate dependency-cruiser boundaries.
