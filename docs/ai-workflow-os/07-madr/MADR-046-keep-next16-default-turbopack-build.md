# MADR-046: Keep Next.js 16 Default Turbopack Build

Status: Accepted and validated

Date: 2026-05-25

## Context

After the dashboard-only reset, webpack builds passed but default `next build` appeared to stall. Because Next.js 16 uses Turbopack by default, falling back to webpack would hide an important production-readiness issue.

## Decision

Keep `apps/app` on the default `next build` Turbopack path.

Do not change the app build script to `next build --webpack`.

Use `next build --webpack` only as a diagnostic fallback while debugging Turbopack-specific issues.

## Evidence

- Next.js Turbopack docs state Turbopack is the default bundler and `--webpack` is an explicit opt-in fallback. https://nextjs.org/docs/app/api-reference/turbopack
- Next.js 16 upgrade docs require validating version-16 behavior instead of relying on older defaults. https://nextjs.org/docs/app/guides/upgrading/version-16
- Local validation showed the apparent stall was caused by command sandbox restrictions. Turbopack failed inside the sandbox with `Operation not permitted (os error 1)` while creating a process and binding to a local port during CSS/PostCSS evaluation.
- The same command passed outside the command sandbox:
  - command: `pnpm --filter app build`
  - bundler: Turbopack
  - Next.js: 16.2.6
  - result: success
  - route output: dashboard/auth reset shell only.

## Consequences

Positive:

- Keeps the app aligned with current Next.js 16 behavior.
- Avoids masking Turbopack problems with webpack.
- Gives future CI/dev validation the correct permission requirement.

Negative:

- Local Codex/tool sandbox runs may need escalation for Turbopack builds.
- Build troubleshooting must distinguish app/config failures from local sandbox restrictions.

## Impacted Files and Packages

- `apps/app/package.json`
- `apps/app/next.config.ts`
- `packages/next-config/index.ts`
- `docs/ai-workflow-os/09-research/2026-05-25-next16-turbopack-reset-validation.md`

## Validation Checklist

- [x] Reproduce default Turbopack build inside command sandbox.
- [x] Capture the actual failure after a longer run.
- [x] Confirm sandbox failure includes local process/port permission denial.
- [x] Restore temporary config changes used for isolation.
- [x] Run default `pnpm --filter app build` outside command sandbox.
- [x] Confirm route output only includes dashboard/auth reset shell.
- [ ] Run app typecheck after doc updates.
- [ ] Run `git diff --check`.
