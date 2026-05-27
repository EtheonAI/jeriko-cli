# Node, pnpm, and Linting Upgrade Checklist

Date: 2026-05-25

## Phase

Current phase: active workspace package-manager/runtime upgrade.

## References

- pnpm 11 settings: `https://pnpm.io/settings`
- pnpm build approvals: `https://pnpm.io/cli/approve-builds`
- Husky Get Started: `https://typicode.github.io/husky/get-started.html`
- Husky How To: `https://typicode.github.io/husky/how-to.html`
- lint-staged v17 migration: `https://github.com/lint-staged/lint-staged/blob/main/MIGRATION.md`
- lint-staged README: `https://github.com/lint-staged/lint-staged`
- Node.js 22.22.1 LTS release: `https://nodejs.org/en/blog/release/v22.22.1`
- Vercel Node versions: `https://vercel.com/docs/functions/runtimes/node-js/node-js-versions`
- Next.js 16 upgrade guide: `https://nextjs.org/docs/app/guides/upgrading/version-16`

## Checklist

- [x] Verify current pnpm latest from fresh registry metadata.
- [x] Verify `pnpm@11.3.0` engine requirement.
- [x] Verify current lint-staged latest and engine requirement.
- [x] Verify Next.js 16 Node minimum.
- [x] Verify Vercel Node major-version behavior.
- [x] Move pnpm install policy to `pnpm-workspace.yaml`.
- [x] Keep `.npmrc` for registry/cache/auth-style settings only.
- [x] Add `.nvmrc`.
- [x] Raise root Node engine to `>=22.22.1`.
- [x] Pin `packageManager` to `pnpm@11.3.0`.
- [x] Add explicit `allowBuilds` policy.
- [x] Run pnpm 11 install under Node 22.22.1.
- [x] Resolve remaining peer/install conflicts from pnpm 11 output.
- [x] Run fresh `pnpm outdated -r --format json`.
- [x] Run `pnpm typecheck`.
- [x] Run focused contracts/search Vitest projects.
- [x] Run focused app typechecks if full typecheck is too broad.
- [x] Run linting audit and update lint debt report.
- [x] Run docs broken-link lint with the upgraded Mintlify CLI package.
- [x] Update package registry research document with corrected stale-cache findings.
- [x] Update MADR index and decision table.
- [x] Re-check Husky official docs and latest registry version.
- [x] Re-check lint-staged README and latest registry version.
- [x] Keep `prepare: husky` and a tiny root `.husky/pre-commit` hook.
- [x] Make lint-staged use local dependencies only via `npx --no-install`.
- [x] Add explicit staged diff filtering for added/copied/modified/renamed files only.
- [x] Add relative path and max argument length hardening for large reset commits.
- [x] Ignore `.pnpm-store/` so local pnpm store files cannot be staged again.
- [x] Filter inactive `legacy/` reference files out of active pre-commit ESLint/Prettier tasks.
- [x] Run hardened lint-staged against the current staged set.
- [ ] Commit with hooks enabled.
