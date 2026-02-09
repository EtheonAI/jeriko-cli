# planner — Testing Rules

## What This Is
Plan display system: PlannerBar (above input) + ShowPlanRenderer (inline in messages).

## Architecture
- `use-planner-state.ts`: Scans messages for LATEST `show_plan` tool part → builds PlannerState
- `planner-bar.tsx`: Renders above prompt input when plan exists

## Critical Rules
1. **show_plan is a TOOL** — plan is NOT derived from tool history
2. Planner ONLY shows when agent explicitly calls `show_plan`
3. Simple Q&A (no tools) → planner hidden
4. Multiple show_plan calls → use the LATEST one (last in messages array)
5. No tool linking — planner shows plan steps only, tool calls render inline separately

## What to Test
1. No messages → no plan → PlannerBar hidden
2. Message with show_plan tool → plan extracted → PlannerBar visible
3. Multiple show_plan calls → latest plan displayed
4. Plan step statuses: pending, in_progress, completed
5. Plan with no steps → graceful handling
6. show_plan with undefined args → loading state shown

## Existing Tests
- `__tests__/planner-bar.test.tsx`
