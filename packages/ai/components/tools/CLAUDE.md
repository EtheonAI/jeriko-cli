# tools — Testing Rules

## What This Is
Tool registry and renderers for all 34 agent tools. Every tool call from the agent renders through this system.

## Architecture
- `tool-registry.tsx`: Maps tool names → React components. `getToolRenderer(name)` returns renderer.
- `tool-card.tsx`: Wrapper card UI for tool invocations
- `tool-compact.tsx`: Compact inline tool display
- `renderers/`: Individual tool renderers (ShowPlan, BrowserNavigate, ShellExec, etc.)

## All 34 Tools (MUST have renderers)

**Communication (2):** message_notify_user, message_ask_user
**File (5):** file_read, file_write, file_str_replace, file_find_in_content, file_find_by_name
**Shell (5):** shell_exec, shell_view, shell_wait, shell_write_to_process, shell_kill_process
**Code (1):** code_execute
**Search (1):** web_search
**Browser (13):** browser_navigate, browser_view, browser_click, browser_input, browser_scroll, browser_scroll_up, browser_scroll_down, browser_move_mouse, browser_key_press, browser_press_key, browser_select_option, browser_console_exec, browser_console_view, browser_screenshot, browser_restart
**Deploy (2):** deploy_expose_port, deploy_apply_deployment
**Image (1):** generate_image
**Schedule (1):** schedule_task
**Analytics (1):** track_analytics
**Plan (1):** show_plan

## Test Rules
1. **Completeness test**: `it.each(ALL_TOOLS)` → verify `getToolRenderer(tool) !== GenericTool`
2. **Both variants**: Test `show_plan` AND `showPlan` (snake_case + camelCase)
3. **States**: Test each renderer in pending (loading), complete (result), error states
4. **Props**: Test that renderers handle missing/undefined args gracefully
5. **GenericTool**: Unknown tools should fall back to GenericTool (not crash)
6. **Adding tools**: Add renderer → add to ALL_TOOLS test list → add to TOOL_VIEW_MAP → implement

## Existing Tests
- `__tests__/tool-registry.test.tsx` (211 lines — comprehensive)
- `__tests__/tool-registry-devices.test.tsx`
- `__tests__/tool-inline-compact.test.tsx`
- `__tests__/device-command.test.tsx`
