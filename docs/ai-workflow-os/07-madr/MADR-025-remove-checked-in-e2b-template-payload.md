# MADR-025: Remove Checked-In E2B Template Payload From Active Base

Date: 2026-05-23

Status: Accepted

## Context

The repo is being reset from a Manus-style agent/chat platform into AI Workflow OS. The target sandbox direction is Vercel Sandbox behind a provider-neutral sandbox interface, not a checked-in E2B desktop image as the product primitive.

Local evidence:

- `e2b-templates` is about 187M in the current working tree.
- `git ls-files e2b-templates` reports 5,069 tracked files.
- the tracked tree still contains old `rubic-files` paths, while the working tree also contains a renamed `jeriko-files` payload.
- `e2b-templates/desktop/jeriko-files` contains old webdev templates, browser extensions, Neko assets, compressed template archives, and Manus strings.
- only two active source references outside `e2b-templates` point directly at the local template folder:
  - `services/orchestrator/test-browser-flow.mts`
  - `services/orchestrator/src/scripts/upload-neko-client.ts`
- live sandbox execution code depends on `@e2b/code-interpreter`, but not on keeping this local template payload in the active repo.

External evidence checked on 2026-05-23:

- [Vercel Sandbox docs](https://vercel.com/docs/vercel-sandbox/) describe `@vercel/sandbox` as the SDK path for creating sandboxes, running commands, managing files, and live previews.
- [Vercel Sandbox system specifications](https://vercel.com/docs/vercel-sandbox/system-specifications) list `node24`, `node22`, and `python3.13` runtimes on Amazon Linux 2023 with `sudo`.
- [Vercel Sandbox pricing and limits](https://vercel.com/docs/vercel-sandbox/pricing) documents runtime and open-port limits that must be validated before replacing all E2B behavior.

## Decision

Delete the checked-in E2B template payload from the active repo.

Keep E2B SDK runtime code only as temporary compatibility until the provider-neutral sandbox adapter and Vercel Sandbox proof pass.

Do not migrate the old E2B template folder to a Vercel template folder. Vercel Sandbox should get a fresh minimal provider implementation and, if needed later, a documented Vercel snapshot/build recipe. The old Manus desktop image should not become the new foundation.

## Consequences

Positive:

- removes thousands of vendor/template files from the project base.
- removes old Manus/Rubic/Neko payloads from ordinary source scans.
- avoids carrying an E2B image build system into the Vercel Sandbox migration.
- makes future sandbox work provider-neutral by default.

Negative:

- the old E2B desktop image cannot be rebuilt from this repo after deletion.
- old Neko/code-server parity scripts must be deleted or rewritten.
- if E2B compatibility is needed temporarily, it must use already-published template IDs or a separate archived template source outside the active app repo.

## Alternatives Considered

### Keep the template folder

Rejected. It keeps the repo noisy, preserves the old product center, and encourages new work to target E2B-specific desktop assumptions.

### Rename `e2b-templates` to `vercel-templates`

Rejected. That would launder old Manus/E2B assumptions into the new platform. Vercel Sandbox needs a clean provider implementation.

### Delete all E2B runtime code now

Rejected for this phase. The sandbox service and orchestrator still contain E2B-specific execution, file, terminal, browser, preview, and DB assumptions. Delete those only after the provider-neutral adapter is in place and Vercel proof tests pass.

## Impacted Files And Packages

- `e2b-templates/**`
- `services/orchestrator/test-browser-flow.mts`
- `services/orchestrator/src/scripts/upload-neko-client.ts`
- `.gitignore`
- `eslint.config.mjs`
- sandbox migration docs under `docs/ai-workflow-os`

## Validation Checklist

- [x] Delete `e2b-templates/**`.
- [x] Delete direct local-template scripts.
- [x] Remove lint/gitignore exceptions that only existed for `e2b-templates`.
- [x] Confirm no active source references `e2b-templates`, `rubic-files`, or local `jeriko-files` template paths outside canonical docs.
- [ ] Keep `@e2b/code-interpreter` only in compatibility provider code until replacement.
- [ ] Add Vercel Sandbox provider proof before deleting E2B runtime code.
