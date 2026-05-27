# MADR-071: Design System Owns Primitives, Not Domain UI

Date: 2026-05-26

Status: Accepted

## Context

The repo has three UI layers that are easy to confuse:

- `@repo/design-system`: shared primitives, tokens, global styles, and generic UI infrastructure.
- `@repo/ai/components`: AI/workflow/chat/canvas/tool-result domain UI.
- app route-local `_components`: route-specific compositions such as auth pages, dashboard shell, and page sections.

The correct fix is not to move every UI component into `@repo/design-system`. That would make the design system a product UI junk drawer. The correct fix is to make `@repo/design-system` the source of shared primitives and visual language, while domain packages and routes compose those primitives.

## Sources Checked

| Source                                                      | Type          | Checked Date | Evidence Used                                                                                                                    |
| ----------------------------------------------------------- | ------------- | -----------: | -------------------------------------------------------------------------------------------------------------------------------- |
| https://ui.shadcn.com/docs                                  | Official docs |   2026-05-26 | shadcn/ui components are copied into the codebase and owned/customized by the project.                                           |
| https://ui.shadcn.com/docs/monorepo                         | Official docs |   2026-05-26 | Monorepo setup uses a shared UI package for reusable components consumed by apps.                                                |
| https://turborepo.com/repo/docs/core-concepts/package-types | Official docs |   2026-05-26 | Library packages support apps; app packages are deployment surfaces and should stay at graph endpoints.                          |
| Local `packages/design-system` audit                        | Repo evidence |   2026-05-26 | Package already owns shadcn primitives, theme provider, global styles, `cn`, sidebar/resizable/chart/virtual-list primitives.    |
| Local `packages/ai/components` audit                        | Repo evidence |   2026-05-26 | Package owns AI domain UI: chat, prompt input, message parts, canvas views, tool renderers, terminal/browser/code/file previews. |
| Local `apps/app/app` audit                                  | Repo evidence |   2026-05-26 | Route-local auth/dashboard/sidebar components compose design-system primitives but still carry route-specific styling and copy.  |

## Decision

Keep a layered UI architecture:

```text
@repo/design-system
  design tokens
  global styles
  shadcn primitives
  generic UI primitives/patterns

@repo/ai/components
  AI chat/workbench/canvas/tool-result domain UI
  uses @repo/design-system primitives

apps/*/app/**/_components
  route-specific composition
  uses @repo/design-system and domain package components
```

`@repo/design-system` owns:

- shadcn/ui primitive source;
- theme, font, Tailwind, global CSS, utility helpers;
- generic input/button/dialog/sheet/sidebar/table/tabs/tooltip/card/badge primitives;
- generic loading, empty, virtual-list, chart, resizable, scroll-area, and layout primitives when product-agnostic;
- shared visual tokens and reusable class-variant patterns.

`@repo/design-system` must not own:

- AI SDK tool adapters or platform tools;
- chat runtime logic;
- AI message semantics;
- workflow run semantics;
- connector/integration behavior;
- route-specific auth/dashboard/workflow copy;
- terminal/browser/code/file-preview implementations that are tied to sandbox/workflow data.

`@repo/ai/components` owns:

- chat container/message/input/prompt UI;
- AI message part renderers;
- tool-call/tool-result renderers;
- workflow workbench/canvas views;
- terminal/browser/code/file/artifact preview compositions when tied to AI/workflow state.

App route-local `_components` own:

- page shells and route-specific copy;
- auth forms and dashboard layout before they are proven reusable across apps/routes;
- workflow page composition once routes are added.

## Extraction Rule

Move a component to `@repo/design-system` only when all are true:

- It is product-agnostic.
- It has no AI SDK, workflow, auth, connector, database, sandbox, or app-route dependency.
- It can be named without product/domain language.
- At least two packages/apps/routes need the same primitive or pattern.
- Its props are visual/interaction primitives, not domain data contracts.

Keep a component outside `@repo/design-system` when it:

- renders AI tool-call/tool-result semantics;
- knows about `.flow`, workflow runs, approvals, artifacts, sandbox sessions, connectors, or auth flow state;
- contains app copy or route navigation;
- imports provider SDKs or domain contracts;
- needs server-only behavior.

## Current Audit Findings

- `@repo/design-system` currently has the right base shape: shadcn primitives, provider composition, tokens, and UI helpers.
- `@repo/ai/components` is valid as a domain UI package, but it should rely more consistently on design-system primitives and avoid duplicating primitive button/card/toolbar styling.
- `apps/app` route-local auth/dashboard components are mostly correctly local, but repeated auth form patterns may later become design-system form patterns only if made product-agnostic.
- `packages/design-system/package.json` still lists several dependencies that appear AI/domain-adjacent or unused in the current audit, including `ai`, `streamdown`, `@streamdown/*`, `use-stick-to-bottom`, and `react-moveable`. These need a design-system dependency cleanup pass before the UI rebuild.

## Consequences

Positive:

- Prevents design-system from becoming another mixed product package.
- Keeps AI/workflow UI reusable without coupling design primitives to AI runtime behavior.
- Makes future redesign easier: restyle tokens/primitives once, then domain UI follows.
- Keeps app pages clean with route-local composition.

Tradeoffs:

- `@repo/ai/components` remains a UI package, not just server AI helpers.
- Some components will feel reusable but must stay route/domain-local until they have a second consumer.
- A dependency cleanup pass is needed to remove stale non-primitive dependencies from design-system safely.

## Implementation Checklist

- [x] Keep `@repo/design-system` focused on primitives, tokens, providers, and generic patterns.
- [x] Keep `@repo/ai/components` as AI/workflow domain UI that imports design-system primitives.
- [x] Keep `@repo/ai/tools` server-only and UI-free.
- [ ] Keep `@repo/connectors` UI-free.
- [x] Audit `packages/design-system/package.json` for unused or domain-specific dependencies before the redesign.
- [ ] Do not move route-local auth/dashboard/workflow components into design-system until reuse is proven.
- [ ] Add dependency-cruiser or lint rules later if design-system starts importing AI/app/domain packages.
- [x] Add segmented design-system category barrels without moving shadcn source.
- [x] Add `packages/ai/components/ai` as the AI/workflow UI system facade.
- [ ] During UI rebuild, extract repeated primitive patterns into design-system first, then restyle domain UI.

## Validation

Latest cleanup pass on 2026-05-26:

- `pnpm --filter @repo/design-system typecheck` passed.
- `pnpm --filter @repo/ai typecheck` passed.
- `pnpm --filter "./packages/*" typecheck` passed.
- `pnpm --filter app --filter web typecheck` passed.
- `pnpm exec vitest run --project @repo/ai` passed: 15 files, 465 tests.
- `pnpm test` passed: 19 files, 481 tests.
- `pnpm boundaries:cruise` passed with 0 errors and 0 warnings; informational orphan findings remain.
