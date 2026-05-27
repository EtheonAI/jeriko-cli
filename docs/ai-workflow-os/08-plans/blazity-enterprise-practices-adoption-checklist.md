# Blazity Enterprise Practices Adoption Checklist

Date: 2026-05-26

Status: active checklist

Purpose: adopt useful Blazity governance/performance practices without copying stale package versions or changing this repo's monorepo architecture.

## Adopted Now

- [x] Treat Blazity as a governance/performance reference, not a template.
- [x] Compare README claims against package manifest and repo structure.
- [x] Keep Renovate for dependency/security updates.
- [x] Remove stale Drizzle `0.38.x` Renovate pin after confirming latest/current `drizzle-orm@0.45.2`.
- [x] Keep dependency-cruiser as the package/app graph gate.
- [x] Keep T3 Env as the env contract.
- [x] Keep Changesets as release/versioning ownership.
- [x] Keep `packages/design-system` as shared primitive ownership.
- [x] Add dependency-addition review gates to standards.
- [x] Add route-level performance review gates to standards.

## Deferred Until Dedicated Phases

- [ ] Storybook repair and visual/component documentation phase.
- [ ] Lighthouse CI enforcement after authenticated shell routes stabilize.
- [ ] Playwright E2E after workflow creation/auth/account flows stabilize.
- [ ] Observability hardening with OpenTelemetry/Speed Insights/RUM decisions.
- [ ] Dependency graph visualization only if dependency-cruiser output is insufficient.
- [ ] `patch-package` only for a documented upstream defect.

## Reject For This Repo

- [x] Do not copy Blazity's Next 15 package versions.
- [x] Do not move to Blazity's root single-app structure.
- [x] Do not add semantic-release while Changesets is the repo release model.
- [x] Do not add `@next/bundle-analyzer` by default; use Next 16 native analyzer first.

## Route Performance Review Checklist

Use this during R17 authenticated shell cleanup and future workflow routes:

- [ ] Page/layout is Server Component by default.
- [ ] Client Components are narrow and leaf-oriented.
- [ ] No heavy optional UI enters the initial client bundle without evidence.
- [ ] Heavy conditional UI uses dynamic import only when it is below-fold, modal, tabbed, or otherwise non-critical.
- [ ] Suspense/loading states preserve stable dimensions and avoid layout shifts.
- [ ] True LCP images are prioritized; non-critical images are lazy-loaded.
- [ ] Images use `next/image` where appropriate and define dimensions or `sizes`.
- [ ] Fonts are self-hosted through `next/font` or equivalent approved design-system strategy.
- [ ] Third-party scripts are justified and loaded with an explicit strategy.
- [ ] Rendering/caching behavior is route-specific and source-backed; no cache directives by memory.

## Dependency Addition Checklist

Before adding any package:

- [ ] Check latest official docs.
- [ ] Check npm metadata: latest version, engines, peer dependencies.
- [ ] Check native Next.js/React/browser alternatives.
- [ ] Check current repo package already covering the need.
- [ ] Check bundle/runtime impact.
- [ ] Check tree-shaking and modular import support.
- [ ] Check maintenance health.
- [ ] Check if the package belongs in app code, design-system, runtime adapter, testing, or tooling.
- [ ] Document the decision in a package playbook/MADR if it changes architecture, runtime, env, security, testing, or build behavior.
