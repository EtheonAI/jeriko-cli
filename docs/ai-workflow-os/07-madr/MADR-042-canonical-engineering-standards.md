# MADR-042: Adopt canonical engineering standards before further cleanup

Status: Accepted

Date: 2026-05-25

## Context

The reset has exposed repeated drift risks: package behavior guessed from memory, direct env access bypassing T3 Env, feature removal used as a quick build fix, and stale framework assumptions. The next cleanup phases touch Next.js 16.2.6, env, monorepo boundaries, feature flags, CMS isolation, app build behavior, lint debt, and future Payload evaluation.

Those phases need one mandatory rulebook.

## Decision

Adopt `docs/ai-workflow-os/00-ENGINEERING-STANDARDS.md` as the canonical engineering standard for future work in this repo.

Before further cleanup/refactor/code changes, the agent must:

- identify the current phase;
- audit local usage;
- check current primary docs/package metadata;
- document architecture decisions with MADRs;
- keep T3 Env as the app/package env contract;
- follow Next.js 16.2.6 App Router conventions;
- verify with targeted typecheck/build/test/lint;
- update docs/checklists with actual results.

## Consequences

Positive:

- Reduces assumptions and hallucinated package behavior.
- Protects feature ownership from accidental deletion.
- Keeps cleanup/refactor decisions reproducible.
- Gives future sessions a single read-first standard.

Negative / follow-up:

- Adds documentation overhead before changes.
- Slows impulsive fixes, but this is intentional because the repo is being reset.

## Alternatives Considered

- Keep standards spread across operating memory, MADRs, and chat: rejected because it makes drift more likely.
- Only rely on developer/system instructions: rejected because repo-specific rules need to live with the codebase.
- Add standards after cleanup: rejected because cleanup is exactly when drift has been most expensive.

## Evidence

Primary sources and repo evidence are recorded in:

- `../00-ENGINEERING-STANDARDS.md`
- `../09-research/2026-05-25-engineering-standards-source-review.md`

## Impacted Files

- `docs/ai-workflow-os/00-ENGINEERING-STANDARDS.md`
- `docs/ai-workflow-os/00-OPERATING-MEMORY.md`
- `docs/ai-workflow-os/README.md`
- `docs/ai-workflow-os/09-research/research-index.md`

## Validation Checklist

- [x] Primary docs checked.
- [x] Standards file added.
- [x] Research source review added.
- [x] Documentation hub linked.
- [x] MADR index updated.
