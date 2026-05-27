# Husky and lint-staged Hook Hardening

Date: 2026-05-27

## Scope

This research covers the root Git pre-commit hook after a failed commit/push attempt staged more than one thousand files, included local pnpm store state, and was reverted by lint-staged.

## Sources

- Husky Get Started: `https://typicode.github.io/husky/get-started.html`
- Husky How To: `https://typicode.github.io/husky/how-to.html`
- lint-staged README: `https://github.com/lint-staged/lint-staged`
- npm registry check: `npm view husky version engines --json`
- npm registry check: `npm view lint-staged version engines --json`

## Verified Facts

- Husky latest stable checked on 2026-05-27 is `9.1.7`.
- Husky supports the normal `prepare: husky` setup and creates small hook files in `.husky/`.
- Husky hook scripts should remain POSIX-compatible when possible.
- Husky can be disabled with `HUSKY=0`, and CI/Docker installs may also set `HUSKY=0`.
- lint-staged latest stable checked on 2026-05-27 is `17.0.5`.
- lint-staged `17.0.5` requires Node `>=22.22.1`, matching the repo engine baseline.
- lint-staged defaults to staged files and `ACMR` diff filtering, but the hook should pass the filter explicitly so deleted files are never handed to formatters during large reset commits.
- lint-staged supports JavaScript/ESM config and function values, which is appropriate for repo-specific filtering and chunking.
- lint-staged supports `--relative` and `--max-arg-length`; these reduce absolute-path command noise and avoid oversized argument lists during large staged resets.
- lint-staged stashes and reverts changes by default when a task fails. That protected the worktree, but it also means the hook must avoid local/generated files that should never be staged.

## Local Audit

- Root `package.json` already has `husky@^9.1.7` and `lint-staged@^17.0.5`.
- Root `package.json` already uses `prepare: husky`.
- Root engine baseline is `node >=22.22.1`, which is required by lint-staged `17.0.5`.
- `.pnpm-store/v11/index.db*` was accidentally staged and produced a bogus rename from `apps/app/e2e/.auth/.gitkeep` to `.pnpm-store/v11/index.db-wal`.
- `.pnpm-store/` was not ignored before this hook hardening pass.
- `legacy/` files are inactive reference code and are already ignored by ESLint, so passing them to staged ESLint produces ignored-file warnings without improving active workspace quality.
- The staged hook run failed on a real active-code issue in `apps/storybook/stories/sidebar.stories.tsx`: React `useState` was called inside a Storybook `render` callback instead of a React component.
- The lint-staged backup stash should not be applied blindly because it may contain stale backup state from older failed hook attempts.

## Decision Impact

- Keep Husky and lint-staged; the tools are current and fit the repo.
- Do not bypass hooks with `--no-verify` for normal commits.
- Add `.pnpm-store/` to `.gitignore`.
- Keep the hook tiny and local: `npx --no-install lint-staged ...`.
- Make lint-staged deterministic for large reset commits:
  - explicit `--diff-filter=ACMR`
  - serial `--concurrent=false`
  - relative paths
  - bounded command length
  - JS config with existing-file filtering
  - active workspace filtering that skips `legacy/`, `.pnpm-store/`, and generated E2B template payloads
  - chunked command generation
- Fix active hook-blocking lint errors instead of weakening ESLint.

## Validation Checklist

- [x] Latest Husky version checked against npm registry.
- [x] Latest lint-staged version checked against npm registry.
- [x] Official Husky docs reviewed.
- [x] lint-staged README reviewed.
- [x] Local hook, config, engines, and lockfile audited.
- [x] `.pnpm-store/` excluded from Git tracking.
- [x] Hardened hook runs successfully against the current staged reset.
- [ ] Commit succeeds without bypassing the hook.
- [ ] Push succeeds after a clean commit.
