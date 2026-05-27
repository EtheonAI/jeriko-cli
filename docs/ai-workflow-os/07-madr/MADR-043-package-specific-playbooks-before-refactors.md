# MADR-043: Require package-specific playbooks before critical refactors

Status: Accepted

Date: 2026-05-25

## Context

The repo-level engineering standards now define the overall process, but the cleanup has exposed package-specific failure modes:

- env contracts can be bypassed or over-centralized;
- optional integrations can accidentally require secrets during unrelated builds;
- package imports can force auth/database validation at module load;
- Next.js app structure can be changed based on generic taste rather than documented App Router behavior;
- provider packages such as payments, CMS, AI, storage, sandbox, and feature flags need current package docs before changes;
- not every active package has the same risk level.

The next phase touches `apps/app`, auth, database, AI/tooling, design system, feature flags, security, payments, linting, and optional integration packages. Repo-level standards alone are too broad to prevent drift inside each package.

## Decision

Require a package-specific playbook before refactoring any P0 app/package or changing the architecture of a P1 package.

The playbook must include:

- official sources checked;
- latest package metadata or explicit note if no external package applies;
- local usage map;
- env contract;
- server/client/runtime boundary;
- allowed and forbidden imports;
- keep/refactor/delete decisions;
- verification gates;
- risks and open questions.

Use `docs/ai-workflow-os/08-plans/package-best-practices-registry.md` as the priority matrix and template.

## Consequences

Positive:

- Prevents package work from relying on memory or guessed best practices.
- Keeps critical changes reproducible and reviewable.
- Makes it clear which packages are core, which are optional, and which are gated.
- Reduces accidental feature deletion, env drift, package coupling, and stale-provider fixes.

Negative / follow-up:

- Adds overhead before touching P0/P1 packages.
- Requires discipline to keep playbooks short, evidence-backed, and current.
- P2 packages still need gate/archive decisions before final cleanup.

## Alternatives Considered

- Document every npm dependency in full before continuing: rejected because it creates documentation drag without improving the immediate reset.
- Rely only on `00-ENGINEERING-STANDARDS.md`: rejected because package-specific env/runtime/provider behavior is where most reset mistakes happen.
- Write playbooks only after code changes: rejected because the point is to guide safe changes before they happen.

## Evidence

Primary sources and repo evidence are recorded in:

- `../09-research/2026-05-25-package-best-practices-source-review.md`
- `../08-plans/package-best-practices-registry.md`
- `../00-ENGINEERING-STANDARDS.md`
- `../01-architecture/package-ownership-index.md`

## Impacted Files

- `docs/ai-workflow-os/08-plans/package-best-practices-registry.md`
- `docs/ai-workflow-os/09-research/2026-05-25-package-best-practices-source-review.md`
- `docs/ai-workflow-os/00-ENGINEERING-STANDARDS.md`
- `docs/ai-workflow-os/README.md`
- `docs/ai-workflow-os/07-madr/README.md`
- `docs/ai-workflow-os/07-madr/madr-decisions.csv`
- `docs/ai-workflow-os/07-madr/madr-decisions.md`
- `docs/ai-workflow-os/09-research/research-index.md`

## Validation Checklist

- [x] Source review added.
- [x] Package registry and playbook template added.
- [x] MADR added.
- [x] Documentation hub linked.
- [x] Decision indexes updated.
- [x] Markdown diff check passed.
