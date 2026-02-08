# ADR-001: Enterprise Feature Decisions for Next.js 16.1 Monorepo

**Status:** Accepted
**Date:** 2026-02-08
**Authors:** Khaleel Musleh
**Context:** Rubic monorepo — Next.js 16.1.5, React 19.2.3, TypeScript 5.9.3, pnpm 10.19.0, Turbo 2.5.8
**Reference:** [Blazity next-enterprise](https://github.com/Blazity/next-enterprise) feature list

---

## Summary

This ADR documents architectural decisions for each enterprise feature in the Rubic monorepo. For every feature from the Blazity next-enterprise reference, we evaluated: (1) whether it's compatible with Next.js 16.1, (2) what enterprises actually use in 2026, (3) our decision, and (4) the rationale.

---

## 1. Bundle Analyzer

### Context
Blazity next-enterprise lists "Bundle analyzer" as a feature. In Next.js 16.1, there are **two options**:

1. **Built-in Turbopack Bundle Analyzer** (experimental, v16.1+) — `npx next experimental-analyze`
2. **@next/bundle-analyzer** plugin (Webpack-based, requires installation)

### Decision: Use the built-in Turbopack Bundle Analyzer

### Rationale
- Next.js 16.1 ships a **native, interactive Bundle Analyzer** integrated with Turbopack's module graph ([Next.js 16.1 blog](https://nextjs.org/blog/next-16-1))
- Activated with `npx next experimental-analyze` — no package installation required
- Provides precise import tracing, route-level filtering, client/server separation
- Output can be saved to `.next/diagnostics/analyze` for comparison between builds
- `@next/bundle-analyzer` is the **Webpack** approach — our monorepo uses **Turbopack**, so the native analyzer is the correct choice
- **No need to install `@next/bundle-analyzer`** — it would only apply to Webpack builds

### Action
- Add `"analyze": "next experimental-analyze"` script to `apps/app/package.json`
- Add `"analyze": "next experimental-analyze --output"` for CI artifact generation
- Keep Turbo task `analyze` in `turbo.json` pointed to this

### Sources
- [Next.js Package Bundling Guide](https://nextjs.org/docs/app/guides/package-bundling)
- [Next.js 16.1 Release Blog](https://nextjs.org/blog/next-16-1)

---

## 2. Observability (OpenTelemetry)

### Context
Blazity lists "OpenTelemetry integration." Rubic uses Sentry v10.22.0 for error tracking, session replay, and distributed tracing.

### Decision: Keep Sentry — it IS OpenTelemetry

### Rationale
- **Sentry SDK v8+ uses OpenTelemetry under the hood** ([Sentry OpenTelemetry docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/opentelemetry/))
- Any OpenTelemetry instrumentation that emits spans is **automatically picked up by Sentry** without additional configuration
- Next.js itself has built-in OpenTelemetry instrumentation that emits spans for every request, middleware execution, and render ([Next.js OTEL Guide](https://nextjs.org/docs/app/guides/open-telemetry))
- Sentry automatically registers OpenTelemetry instrumentation for HTTP requests, DB queries, and more
- You can use OpenTelemetry APIs directly alongside Sentry if custom spans are needed
- Installing `@opentelemetry/*` packages separately would be **redundant** — Sentry already includes them
- Enterprise trend in 2026: Sentry for error tracking + developer experience, OTEL for vendor-neutral telemetry — Sentry bridges both ([PeerSpot comparison](https://www.peerspot.com/products/comparisons/opentelemetry_vs_sentry))

### What This Means
- Rubic **already has OpenTelemetry** via Sentry. No separate installation needed.
- If we ever need to send traces to a different backend (Datadog, Honeycomb, Grafana), we can use Sentry's OTEL bridge or add an OTEL exporter alongside Sentry
- The `instrumentation.ts` file in our app already registers Sentry, which initializes OTEL

### Action
- No changes needed — Sentry IS our OpenTelemetry layer
- Document this in the codebase so future developers don't install redundant OTEL packages
- Consider reducing `tracesSampleRate` from 1.0 to 0.1 for production cost management

### Sources
- [Sentry OpenTelemetry for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/opentelemetry/)
- [Sentry Using OTEL APIs](https://docs.sentry.io/platforms/javascript/guides/nextjs/opentelemetry/using-opentelemetry-apis/)
- [Next.js OpenTelemetry Guide](https://nextjs.org/docs/app/guides/open-telemetry)

---

## 3. TypeScript Strict Flags

### Context
Blazity lists "Strict TypeScript" with ts-reset. Our `base.json` has `strict: true` but is missing three advanced flags: `noUncheckedIndexedAccess`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.

### Decision: Add `noUncheckedIndexedAccess` only. Skip the other two.

### Rationale

**Add `noUncheckedIndexedAccess: true`:**
- TypeScript 5.9's own `tsc --init` now includes `noUncheckedIndexedAccess: true` by default ([TypeScript 5.9 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/))
- Matt Pocock (Total TypeScript) explicitly recommends it as the single most impactful strict flag beyond `strict: true` ([Total TypeScript](https://www.totaltypescript.com/tips/make-accessing-objects-safer-by-enabling-nouncheckedindexedaccess-in-tsconfig))
- Prevents runtime `undefined` errors from array/object index access — the #1 source of TypeScript false-safety bugs
- There is an [open TypeScript issue #49169](https://github.com/microsoft/TypeScript/issues/49169) requesting it be included in `strict: true` — the TS team agrees it should have been there from the start

**Skip `noImplicitReturns`:**
- Already handled by ESLint `consistent-return` rule
- Can produce false positives with early-return patterns and exhaustive switch statements
- Not included in TypeScript 5.9 defaults

**Skip `noFallthroughCasesInSwitch`:**
- Already handled by ESLint `no-fallthrough` rule (enabled in recommended config)
- Rubic codebase uses minimal switch statements (Redux reducers use `createSlice`)
- Not impactful for this codebase

### Action
- Add `"noUncheckedIndexedAccess": true` to `packages/typescript-config/base.json`
- Fix any resulting type errors (typically adding `?` or `!` assertions where access is guaranteed)

### Sources
- [TypeScript 5.9 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/)
- [TypeScript issue #49169](https://github.com/microsoft/TypeScript/issues/49169)
- [Total TypeScript recommendation](https://www.totaltypescript.com/tips/make-accessing-objects-safer-by-enabling-nouncheckedindexedaccess-in-tsconfig)

---

## 4. ESLint in lint-staged (Pre-commit)

### Context
Current lint-staged only runs Prettier. Blazity and most enterprise monorepos run ESLint + Prettier in pre-commit hooks.

### Decision: Add ESLint to lint-staged

### Rationale
- Enterprise best practice: pre-commit is local safety, CI is the full gate ([lint-staged docs](https://github.com/lint-staged/lint-staged))
- Running ESLint on staged files catches type-import issues, React hook violations, and Next.js best-practice violations before they hit CI
- With ESLint 9 flat config, `eslint --fix` is fast on staged files only
- The monorepo pattern: install lint-staged at root, run on staged files with `--fix` to auto-correct what can be fixed ([Enterprise monorepo guide](https://dev.to/monfernape/enforce-husky-pre-commit-with-eslint-prettier-in-monorepo-55jc))
- CI still runs full lint as the authoritative gate — pre-commit is a fast-feedback convenience

### Action
- Update `.lintstagedrc.mjs` to add `eslint --fix` before `prettier --write` for TS/JS files

### Sources
- [lint-staged GitHub](https://github.com/lint-staged/lint-staged)
- [Husky + lint-staged monorepo guide](https://dev.to/monfernape/enforce-husky-pre-commit-with-eslint-prettier-in-monorepo-55jc)

---

## 5. Patch-package

### Context
Blazity lists "Patch-package — external dependency fixes without compromises." Rubic uses pnpm 10.19.0.

### Decision: Use `pnpm patch` (built-in), NOT patch-package

### Rationale
- `pnpm patch` is pnpm's native patching mechanism — it does the same thing as patch-package but is built into the package manager ([pnpm docs](https://pnpm.io/cli/patch))
- No extra dependency to install or maintain
- Patches are stored via `pnpm.patchedDependencies` in `package.json`
- Automatically applied during `pnpm install` — no `postinstall` script needed
- In 2026, for pnpm monorepos, `pnpm patch` is the recommended approach over patch-package ([Enterprise pnpm article](https://medium.com/@hariharakumar5196/why-pnpm-is-becoming-the-go-to-package-manager-for-monorepos-next-js-and-enterprise-applications-ae4332a7e2e7))
- We already use pnpm `overrides` for version pinning (5 overrides configured). `pnpm patch` extends this with actual code patches when needed.

### Action
- No installation needed — `pnpm patch <pkg>` is already available
- When a dependency needs patching: `pnpm patch <pkg>` → edit → `pnpm patch-commit <path>`
- Document the workflow in CONTRIBUTING.md

### Sources
- [pnpm patch documentation](https://pnpm.io/cli/patch)
- [pnpm-patch-i by Antfu](https://github.com/antfu/pnpm-patch-i)
- [Enterprise pnpm guide](https://medium.com/@hariharakumar5196/why-pnpm-is-becoming-the-go-to-package-manager-for-monorepos-next-js-and-enterprise-applications-ae4332a7e2e7)

---

## 6. Storybook

### Context
Storybook 9.1.15 is installed but disabled due to SWC compatibility issue with Next.js 16.

### Decision: Keep disabled until Storybook ships Next.js 16 support

### Rationale
- The `@storybook/nextjs` framework adapter has a known SWC compatibility issue with Next.js 16's compiler changes
- Storybook 9.x is actively maintained and this is a known issue being tracked
- Forcing it to work would require SWC workarounds that could break with Storybook updates
- Chromatic (visual regression testing) is configured and ready — will activate when Storybook works

### Action
- Monitor [Storybook Next.js adapter releases](https://github.com/storybookjs/storybook) for Next.js 16 compatibility fix
- MSW browser integration is already prepared (`@repo/testing/msw/browser`) for when Storybook re-enables

---

## 7. Semantic Release vs Changesets

### Context
Blazity lists "Semantic Release." Rubic uses Changesets.

### Decision: Keep Changesets — it's the superior choice for monorepos

### Rationale
- Semantic Release is designed for single-package repos. It works in monorepos but requires complex multi-package plugins
- Changesets was built specifically for monorepos — it handles workspace versioning, internal dependency bumps, and per-package changelogs natively
- Changesets is used by: Turborepo, Radix UI, shadcn/ui, Vercel AI SDK, tRPC — all monorepo projects
- Our `.changeset/config.json` correctly ignores apps (only versions shared packages)
- GitHub Actions workflow creates release PRs automatically

### Action
- No changes — Changesets is the right tool

---

## 8. Health Checks

### Context
Gateway has comprehensive health endpoints (liveness, readiness, aggregate). 11 of 13 microservices lack health endpoints.

### Decision: Defer microservice health endpoints to deployment phase

### Rationale
- Gateway's `/health/services` endpoint probes all services — this works for development and early staging
- Individual service health endpoints become critical when deploying to Kubernetes with liveness/readiness probes
- The `createService()` factory in `@repo/service-utils` can add a standard `/health` route automatically
- This is a deployment-phase concern, not an application architecture concern

### Action
- When deploying to K8s/ECS: add `/health` routes to `createService()` factory
- For now, Gateway aggregate health is sufficient

---

## Comparison: Rubic vs Blazity next-enterprise

| Feature | Blazity | Rubic | Rubic Equivalent |
|---------|---------|-------|-----------------|
| Next.js | 15 | **16.1.5** | Newer |
| Tailwind CSS | v4 | **v4.1.16** | Same |
| ESLint 9 | Yes | **Yes** (9.39.1, flat config) | Same |
| Prettier | Yes | **Yes** (3.4.2) | Same |
| Corepack + pnpm | Yes | **Yes** (pnpm 10.19.0) | Same |
| Strict TypeScript | Yes + ts-reset | **Yes** (strict + ts-reset 0.6.1) | Same |
| Vitest | Yes | **Yes** (4.0.3, 6 workspace projects) | Same |
| React Testing Library | Yes | **Yes** (16.3.0) | Same |
| Playwright | Yes | **Yes** (1.58.1, 5 browsers) | More comprehensive |
| Storybook | Yes | **Disabled** (Next 16 SWC compat) | Waiting on upstream |
| Smoke/acceptance testing | Yes | **Yes** (k6 + Playwright) | More comprehensive |
| Conventional commits | Yes | **Yes** (commitlint + Husky) | Same |
| Bundle analyzer | Plugin-based | **Built-in** (Turbopack experimental-analyze) | Better (native) |
| OpenTelemetry | Separate install | **Via Sentry** (OTEL under the hood) | Same coverage |
| Health checks | Basic | **Gateway aggregate + K8s probes** | More comprehensive |
| Radix UI | Yes | **Yes** (45+ primitives) | Same |
| CVA | Yes | **Yes** (13 components) | Same |
| Renovate BOT | Yes | **Yes** (14 package groups, auto-merge) | More configured |
| Patch-package | patch-package | **pnpm patch** (native) | Better (built-in) |
| Component graph | Yes | **dependency-cruiser** (7 rules, CI-integrated) | Same |
| Semantic Release | semantic-release | **Changesets** | Better for monorepo |
| T3 Env | Yes | **Yes** (13 sub-schemas, Zod validation) | More comprehensive |
| GitHub Actions | Yes | **Yes** (4 workflows, 9+ jobs) | More comprehensive |
| Lighthouse | Yes | **Yes** (3-run PR audit, CWV thresholds) | Same |
| Absolute imports | Yes | **Yes** (`@/*` + `@repo/*`) | Same |
| MSW | Not listed | **Yes** (23+ endpoints, 5 SSE scenarios) | Additional |
| Faker factories | Not listed | **Yes** (4 factory types) | Additional |
| k6 load testing | Not listed | **Yes** (smoke + load profiles) | Additional |
| Docker CI/CD | Not listed | **Yes** (14 service matrix build) | Additional |
| Trivy security | Not listed | **Yes** (filesystem SARIF scan) | Additional |
| Codecov | Not listed | **Yes** (coverage upload) | Additional |
| CODEOWNERS | Not listed | **Yes** (team-based review routing) | Additional |
| Redux state | Not listed | **Yes** (46 slices, Manus-aligned) | Additional |
| tRPC | Not listed | **Yes** (16 routers, 160+ procedures) | Additional |
| Agent service | Not listed | **Yes** (Python, 32 tools, E2B sandbox) | Additional |

---

## Decision Log

| # | Feature | Decision | Reason |
|---|---------|----------|--------|
| 1 | Bundle analyzer | Use built-in `next experimental-analyze` | Native to Next.js 16.1, no install needed |
| 2 | OpenTelemetry | Keep Sentry (it IS OTEL) | Sentry v10+ uses OTEL under the hood |
| 3 | TypeScript strict | Add `noUncheckedIndexedAccess` only | TS 5.9 default, most impactful single flag |
| 4 | ESLint in lint-staged | Add `eslint --fix` to pre-commit | Enterprise standard, fast feedback |
| 5 | Patch-package | Use `pnpm patch` (built-in) | Native pnpm feature, no extra dep |
| 6 | Storybook | Keep disabled | Waiting on Next.js 16 SWC compat fix |
| 7 | Semantic Release | Keep Changesets | Purpose-built for monorepos |
| 8 | Health checks | Defer per-service endpoints | Gateway aggregate sufficient for now |

---

## References

- [Next.js 16.1 Release Blog](https://nextjs.org/blog/next-16-1)
- [Next.js Bundle Analyzer Guide](https://nextjs.org/docs/app/guides/package-bundling)
- [Next.js OpenTelemetry Guide](https://nextjs.org/docs/app/guides/open-telemetry)
- [Sentry OpenTelemetry for Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/opentelemetry/)
- [TypeScript 5.9 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/)
- [Total TypeScript — noUncheckedIndexedAccess](https://www.totaltypescript.com/tips/make-accessing-objects-safer-by-enabling-nouncheckedindexedaccess-in-tsconfig)
- [pnpm patch documentation](https://pnpm.io/cli/patch)
- [lint-staged for monorepos](https://github.com/lint-staged/lint-staged)
- [Blazity next-enterprise](https://github.com/Blazity/next-enterprise)
- [next-forge production template](https://www.next-forge.com/)
- [Real-world Next.js 14→16 migration](https://dev.to/abhilashlr/migrating-a-large-scale-monorepo-from-nextjs-14-to-16-a-real-world-journey-5383)
