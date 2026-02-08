# ADR-001: Keep AI Components in @repo/ai

**Status:** Accepted
**Date:** 2026-02-08
**Deciders:** Architecture Team

## Context

During the Chat Pipeline refactor, a question arose: should AI-specific UI components (tool renderers, planner, canvas, message parts) live in `packages/ai/` (`@repo/ai`) or be moved into `apps/app/`?

Two rendering issues surfaced during development:

1. **Tailwind CSS v4 not scanning `@repo/ai`** — The `@source` directive in the design-system only scanned `packages/design-system/`, causing Tailwind utility classes used in `@repo/ai` components to be purged from the production CSS bundle. Animations (`animate-spin`, `animate-ping`), colors (`bg-blue-500/10`), and layout utilities appeared broken.

2. **`tool-animations.css` not imported** — The 583-line CSS file defining keyframes (shimmer, spinner, fade-in, spring-bounce, browser-loading-bar) and custom classes (.tool-card states, .terminal-output, .skeleton, ANSI colors) was exported from `@repo/ai` but never imported in the app's CSS chain.

Both issues had the same root cause: the app's CSS pipeline wasn't aware of `@repo/ai`. This is a **configuration problem**, not an architectural one.

## Decision

**Keep all AI components in `@repo/ai`.** Fix the CSS pipeline with two lines in `apps/app/app/styles.css`:

```css
@import "@repo/ai/components/tools/tool-animations.css";
@source "../../../packages/ai/**/*.{ts,tsx}";
```

## Rationale

### Why @repo/ai is the right home

1. **Separation of Concerns** — AI rendering logic (tool cards, browser viewer, terminal output, planner) is domain-specific and distinct from the app shell (routing, auth, layout). Keeping them separate maintains clean boundaries.

2. **Reusability** — `@repo/ai` can be consumed by multiple apps in the monorepo (app, storybook, docs) without duplicating components. The package has 15+ exports in its `package.json`.

3. **Independent Testing** — The package has its own `vitest.config.ts` with jsdom environment. Tests run isolated from the app's test suite: 43 tests across tool-registry, planner-bar, and use-planner-state.

4. **Independent Versioning** — As a separate package, `@repo/ai` can be versioned, changesetted, and published independently.

5. **The Fix is Trivial** — Two lines of CSS configuration. Moving 50+ files between packages to work around a config gap would be over-engineering.

### Why NOT to move to apps/app

- **Coupling** — Moving AI components into the app couples them to Next.js routing and app-specific concerns
- **Duplication risk** — Other apps (storybook) would need copies or awkward cross-app imports
- **Regression risk** — Moving 50+ files with their imports, tests, and type references introduces unnecessary churn
- **Wrong abstraction** — The problem was never "where the files live" but "what the CSS compiler scans"

## The Fix (Applied)

### Before
```css
/* apps/app/app/styles.css */
@import "tailwindcss";
@import "@repo/design-system/styles/globals.css";
```

### After
```css
/* apps/app/app/styles.css */
@import "tailwindcss";
@import "@repo/design-system/styles/globals.css";
@import "@repo/ai/components/tools/tool-animations.css";
@source "../../../packages/ai/**/*.{ts,tsx}";
```

### What each line does

| Line | Purpose |
|------|---------|
| `@import "...tool-animations.css"` | Loads 583 lines of keyframes, custom classes (shimmer, spinner, tool-card states, ANSI colors, terminal output, browser loading bar) |
| `@source "../../../packages/ai/**/*.{ts,tsx}"` | Tells Tailwind CSS v4 to scan `@repo/ai` source files for utility classes (`animate-spin`, `bg-blue-500/10`, `text-green-500`, etc.) so they aren't purged |

### Why @source path uses filesystem, not node_modules

Tailwind CSS v4 `@source` resolves relative to the CSS file. In a pnpm monorepo, `node_modules/@repo/ai` is a symlink to `packages/ai/`. Using the direct filesystem path (`../../../packages/ai/`) avoids symlink resolution issues and works consistently across environments.

## Verification

```bash
# 1. Unit tests pass
cd packages/ai && pnpm vitest run          # 43 tests
cd apps/app && pnpm vitest run             # 51+ tests

# 2. Dev server renders correctly
pnpm dev --filter=app
# Open /chat/test — all 33 tool cards render with animations

# 3. Production build includes AI classes
pnpm build --filter=app
# Check .next/static/css/*.css contains animate-spin, bg-blue-500, shimmer, etc.
```

## Consequences

- **Positive:** Clean package boundary maintained. Other apps can import `@repo/ai` and just need the same two CSS lines.
- **Positive:** All 583 lines of tool animations now load correctly (shimmer, spinner, fade-in, tool-card states, terminal output).
- **Positive:** Tailwind scans AI package — all utility classes (100+ unique) are included in the production bundle.
- **Neutral:** Any new package using Tailwind utilities needs its own `@source` directive in consuming apps. This is standard Tailwind v4 monorepo practice.
- **Risk:** The `@source` path is relative and assumes the monorepo structure won't change. If `packages/ai/` moves, the path needs updating.

## Components Affected

| Path | Count | Description |
|------|-------|-------------|
| `packages/ai/components/tools/` | 12 files | Tool renderers (terminal, browser, code, file, etc.) |
| `packages/ai/components/planner/` | 3 files | PlannerBar, usePlannerState, ShowPlanRenderer |
| `packages/ai/components/canvas/` | 4 files | Agent workspace (browser view, file explorer) |
| `packages/ai/components/parts/` | 8 files | Message part renderers (text, reasoning, sources) |
| `packages/ai/components/chat/` | 3 files | Message list, user/assistant message wrappers |
| `packages/ai/hooks/` | 2 files | useCanvas, useVoiceInput |
| `packages/ai/lib/` | 5 files | Types, models, tool definitions, ANSI parser |
