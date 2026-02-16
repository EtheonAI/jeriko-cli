# packages/ai — Testing Rules

## What This Is
Shared AI components: chat message list, tool renderers, canvas system, planner, message parts. Used by `apps/app`.

## Framework
- **Vitest 4.x** + jsdom
- **@testing-library/react 16.3.x**
- Config: `vitest.config.ts`, setup: `vitest.setup.ts`
- Test command: `pnpm test`

## Test Locations
- `components/canvas/__tests__/` — Canvas state, view detection
- `components/tools/__tests__/` — Tool registry, renderers
- `components/chat/__tests__/` — Message list, streaming
- `components/planner/__tests__/` — Planner bar, state
- `components/parts/__tests__/` — Text, tool parts
- `hooks/__tests__/` — Custom hooks

## Critical Test Rules

### Tool Registry (P0)
- All 34 agent tools MUST have explicit renderers (never fall through to GenericTool)
- Test both `snake_case` and `camelCase` variants
- Test loading state (tool pending), complete state (tool result), error state
- When adding a new tool: add renderer FIRST, then add test, then implement

### Canvas System (P0)
- `TOOL_VIEW_MAP` must be tested for ALL tool→view mappings
- Browser tools (22) → "browser", Terminal tools (12) → "terminal", WebDev IDE tools (9) → "webDevIDE"
- `show_plan`, `message_notify_user`, `generate_image`, etc. → no canvas (undefined)
- Test view switching, state accumulation, screenshot extraction

### Planner (P1)
- `usePlannerState` finds the LATEST `show_plan` tool part in messages
- Plan is NOT derived from tool history — only from explicit `show_plan` calls
- Test with no plan, single plan, multiple plans (should use latest)

### Message Parts (P1)
- Text parts: markdown rendering, code blocks, links
- Tool parts: delegate to tool-registry renderer
- Reasoning parts: collapsible thinking blocks

## Gotchas
- Mock design system components when testing parent logic
- Use `@vitest-environment jsdom` directive for component tests
- Import `@testing-library/jest-dom/vitest` in setup for DOM matchers
