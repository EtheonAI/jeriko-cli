# Docs, Agent Files, And Template Payload Cleanup Audit

Date: 2026-05-23

Scope: remove stale Markdown, agent-local helper files, and checked-in E2B template payloads that are not part of the clean AI Workflow OS base.

## Verdict

Clean them.

The old root Markdown files, repository-local agent skill folders, `CLAUDE.md` instruction files, and checked-in E2B desktop template payloads are not the new product base. They make searches noisy, preserve old Manus assumptions, and increase the chance that future work edits stale docs instead of the canonical `docs/ai-workflow-os` records.

## Audit Findings

### Root Markdown

Found root files:

```text
MANUS_PARITY_VERIFICATION.md
PRE_REFACTOR_CLEANUP_AUDIT.md
Redux-State-Slice-Explanations.md
README.md
```

Decision:

- replace `README.md` with a short current project README.
- delete the three old root audit/parity/state docs because their useful conclusions are superseded by `docs/ai-workflow-os`.

### Agent-Local Files

Found:

```text
.agents/
.claude/
skills/
**/CLAUDE.md
```

Evidence:

- `git ls-files .agents .claude` reports 290 tracked files.
- `git ls-files '*/CLAUDE.md' ...` plus root stale docs and old scripts reports 323 tracked cleanup targets.
- `.gitignore` already ignores `.agents/`, which means tracked copies are legacy residue.

Decision:

- delete repository-local `.agents`, `.claude`, and `skills` helper material.
- delete `CLAUDE.md` files from app/package/service directories.
- keep canonical implementation memory in `docs/ai-workflow-os/00-OPERATING-MEMORY.md`.

### E2B Template Payload

Found:

```text
e2b-templates/
e2b-templates/desktop/rubic-files/
e2b-templates/desktop/jeriko-files/
e2b-templates/desktop/keys/private.pem
```

Evidence:

- `e2b-templates` is about 187M locally.
- `git ls-files e2b-templates` reports 5,069 tracked files.
- old `rubic-files` tracked paths are deleted in the working tree while a new `jeriko-files` copy exists.
- direct non-template references are limited to:
  - `services/orchestrator/test-browser-flow.mts`
  - `services/orchestrator/src/scripts/upload-neko-client.ts`

Decision:

- delete `e2b-templates/**` from the active repo.
- delete direct local-template scripts.
- keep E2B SDK runtime code only as compatibility until Vercel Sandbox migration passes.

## Vercel Sandbox Position

Official Vercel docs checked on 2026-05-23 show that Vercel Sandbox is the right target for the new platform:

- SDK: [`@vercel/sandbox`](https://vercel.com/docs/vercel-sandbox/)
- runtimes: [`node24`, `node22`, `python3.13`](https://vercel.com/docs/vercel-sandbox/system-specifications)
- limits and pricing: [pricing and limits](https://vercel.com/docs/vercel-sandbox/pricing)

This does not mean a blind E2B-to-Vercel search/replace. The correct next step is:

```text
delete old template payload
-> keep compatibility runtime code temporarily
-> add provider-neutral sandbox interface
-> implement Vercel Sandbox provider
-> run proof checklist
-> delete E2B SDK/runtime code
```

## Cleanup Checklist

- [x] Replace root README with current AI Workflow OS README.
- [x] Delete stale root Markdown.
- [x] Delete `.agents`, `.claude`, and `skills`.
- [x] Delete `CLAUDE.md` files.
- [x] Delete `e2b-templates`.
- [x] Delete local-template scripts.
- [x] Remove stale lint/gitignore exceptions for `e2b-templates`.
- [x] Run stale-reference scans.
- [x] Run targeted tests/typechecks after cleanup.
- [x] Record non-cleanup type debt as upgrade-phase work instead of expanding this cleanup branch.

## Verification Results

Commands run after cleanup:

```text
rg stale deleted paths outside docs/ai-workflow-os
rg --files -g '*.md' outside docs/ai-workflow-os
pnpm --filter @repo/contracts test
pnpm --filter @repo/contracts typecheck
pnpm --filter @repo/service-utils test
pnpm --filter @jeriko/sandbox test
pnpm --filter @jeriko/orchestrator typecheck
```

Results:

- stale deleted-path scan found no active `e2b-templates`, `rubic-files`, `test-browser-flow`, `upload-neko-client`, old root-doc, `.agents`, `.claude`, or `CLAUDE.md` references outside canonical docs.
- remaining `jeriko-files` matches are S3 bucket defaults, not deleted template paths.
- remaining `agents` matches are database/domain names, not deleted `.agents` folder paths.
- Markdown outside canonical docs is now limited to normal project/package READMEs.
- contracts tests passed: 112 tests.
- contracts typecheck passed.
- `@repo/service-utils` now exports workspace source instead of ignored generated `dist`, and its tests pass: 11 tests.
- sandbox tests passed without requiring a checked-in or prebuilt service-utils `dist`: 75 tests.
- orchestrator typecheck now passes after the dependency-upgrade compatibility pass; no reported error references deleted E2B template files.
- tracked generated service `dist` folders were also removed after the final generated-artifact sweep.

Cleanup note: generated `packages/service-utils/dist` was removed again after verification.

## Boundary Set 2026-05-23

Do not spend the cleanup phase fixing every orchestrator type error. That work belongs to the package-family upgrade/reset phase because the APIs involved are about to move again.

Reference: [`../07-madr/MADR-026-defer-non-cleanup-type-debt-to-upgrade-phase.md`](../07-madr/MADR-026-defer-non-cleanup-type-debt-to-upgrade-phase.md)

Upgrade follow-up: the orchestrator compatibility work was completed during the upgrade phase, and full recursive workspace typecheck passes.
