# MADR-096A: Harden Husky and lint-staged for Large Reset Commits

Status: Accepted

Date: 2026-05-27

## Context

A commit attempt failed while 1,000+ files were staged. lint-staged correctly created a backup stash and reverted after task failure, but the staged set also included `.pnpm-store/v11/index.db*`, which should never be committed. The same run exposed a real Storybook React Hooks violation.

The repo is in a large reset/refactor phase, so the hook must protect the tree without becoming a source of accidental deletes, fake renames, or hidden bypasses.

## Decision

Keep Husky and lint-staged at the root because the installed versions are current and match the repo runtime baseline:

- `husky@9.1.7`
- `lint-staged@17.0.5`
- `node >=22.22.1`
- `pnpm@11.3.0`

Use a minimal Husky hook that delegates to local lint-staged:

```sh
npx --no-install lint-staged --diff-filter=ACMR --concurrent=false --relative --max-arg-length=8000
```

Use `.lintstagedrc.mjs` for repo-aware command generation:

- filter to existing files before passing paths to tools;
- skip deleted files, `legacy/` reference files, `.pnpm-store/`, and stale generated E2B template payloads;
- chunk file arguments to avoid command-line length failures;
- run ESLint fixes before Prettier for JS/TS files;
- run Prettier for structured docs/config files;
- run `gofmt` only when staged Go files exist.

Ignore `.pnpm-store/` in Git.

Do not apply lint-staged backup stashes automatically. Inspect them first if recovery is needed.

## Consequences

Positive:

- Large staged reset commits are less likely to fail from deleted files, local cache files, or oversized command lines.
- The hook uses local dependencies only and will not silently fetch packages during commit.
- Hook failures still stop the commit and preserve lint-staged's safety behavior.
- The hook remains a quality gate instead of a replacement for full CI.

Negative:

- Serial lint-staged execution is slower than concurrent mode.
- Existing active-code lint violations still block the commit and must be fixed intentionally.
- The hook does not make the full repo lint-clean; it only validates staged files.

## Alternatives Considered

- Disable hooks for this commit: rejected because it hides broken staged code and undermines the cleanup phase.
- Use `pnpm exec lint-staged`: deferred because this machine has stale Corepack path behavior; `npx --no-install` reliably uses local project installs without fetching.
- Run full `pnpm lint` in pre-commit: rejected for now because the active repo still has known broad lint debt and would block all cleanup commits.
- Add `--no-stash`: rejected because the default backup/revert behavior protected the working tree during the failed commit.

## Evidence

- Husky docs recommend `prepare: husky` and small hook files under `.husky/`.
- Husky docs document `HUSKY=0` for intentional disablement and CI/Docker install scenarios.
- lint-staged docs document JavaScript/ESM configs, function syntax, `--diff-filter`, `--relative`, and `maxArgLength`.
- npm registry checks on 2026-05-27 show Husky `9.1.7` and lint-staged `17.0.5` as latest.
- Local audit found `.pnpm-store/v11/index.db*` staged accidentally and a real React Hooks error in `apps/storybook/stories/sidebar.stories.tsx`.

## Impacted Files

- `.husky/pre-commit`
- `.lintstagedrc.mjs`
- `.gitignore`
- `apps/storybook/stories/sidebar.stories.tsx`
- `docs/ai-workflow-os/09-research/2026-05-27-husky-lint-staged-hook-hardening.md`

## Validation Checklist

- [x] Official docs checked before changing hook behavior.
- [x] Latest registry versions checked.
- [x] MADR and research note written before hook refactor.
- [x] `.pnpm-store/` ignored.
- [x] Hardened lint-staged command passes on the current staged set.
- [ ] Commit succeeds with hooks enabled.
- [ ] Push succeeds after commit.
