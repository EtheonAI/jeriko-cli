# MADR-083: Keep Next Config Baseline And Defer Provider Config Moves

Status: Accepted

Date: 2026-05-27

## Context

`@repo/next-config` is consumed by `apps/app` and `apps/web` as the shared baseline `NextConfig`. It currently has no direct provider SDK dependencies, but its config content includes provider-specific runtime policy:

- PostHog CSP hosts and rewrites;
- Knock CSP host;
- manual security headers and CSP.

The user direction is to clean package by package. Moving analytics/security/notification config into their owning packages during P1.2 would cross package phase boundaries and could break app behavior before those packages are audited.

## Decision

Keep `@repo/next-config` as the thin shared Next.js baseline.

In P1.2:

- remove the unused `ANALYZE` env key;
- keep current headers/rewrites/transpile/external package behavior stable;
- document provider-specific config as ownership debt for later package phases.

Future package phases must decide:

- P2.4 `@repo/security`: security headers/CSP ownership;
- P5.3 `@repo/analytics`: PostHog rewrite/CSP ownership;
- P4.7 `@repo/notifications`: notification CSP ownership.

## Evidence

- Next.js documents `headers`, `rewrites`, `serverExternalPackages`, `transpilePackages`, and `reactCompiler` as `next.config` concerns.
- Next.js documents `serverExternalPackages` as an opt-out from bundling server dependencies when native Node resolution is needed.
- Next.js documents `transpilePackages` for monorepo/local packages and selected external dependencies.
- React Compiler support in Next config is current and requires `babel-plugin-react-compiler`, which is already handled by app build dependencies.
- Registry checks on 2026-05-27 show `next@16.2.6` and `@t3-oss/env-nextjs@0.13.11`, matching the workspace requirement.
- Local search found no active `ANALYZE` consumer outside `@repo/next-config/keys`.

## Consequences

Positive:

- avoids cross-package drift;
- removes one unused env key;
- preserves currently passing app build behavior;
- records the exact provider-specific config that must move later.

Negative:

- `@repo/next-config` remains not perfectly clean until security/analytics/notifications phases;
- hard-coded `transpilePackages` and `serverExternalPackages` remain drift-prone until package contributors are redesigned.

## Impacted Files

- `packages/next-config/keys.ts`
- `docs/ai-workflow-os/08-plans/package-playbooks/next-config.md`
- `docs/ai-workflow-os/10-audit/next-config-p1-2-audit-2026-05-27.md`

## Validation Checklist

- [x] Official docs checked.
- [x] Registry metadata checked.
- [x] Consumers searched.
- [x] Provider ownership debt documented.
- [x] Remove unused `ANALYZE` key.
- [x] `@repo/next-config` typecheck passes.
- [x] Affected app/web typechecks run; app passes and web blocker is documented as unrelated to P1.2.
