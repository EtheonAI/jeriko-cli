# canvas — Testing Rules

## What This Is
Reactive canvas system: browser, editor, code, and terminal views. Driven by tool calls in messages.

## Architecture
- `use-canvas.ts`: Scans messages backwards → `TOOL_VIEW_MAP` → determines active view
- `agent-canvas.tsx`: Renders active view, manages tabs
- `views/browser-view.tsx`: Screenshots, search results, URL bar, Take Control
- `views/editor-view.tsx`: Manus FileToolView parity — simple filename header + read-only syntax highlighting
- `views/code-view.tsx`: Full IDE — file tree, tabs, ShikiCodeBlock (for webDevIDE)
- `views/terminal-view.tsx`: Shell output accumulation, per-session PTY

## TOOL_VIEW_MAP (43 total entries)

### Browser (22 entries)
browser_navigate, browser_view, browser_click, browser_input, browser_scroll,
browser_scroll_up, browser_scroll_down, browser_move_mouse, browser_key_press,
browser_press_key, browser_select_option, browser_console_exec, browser_console_view,
browser_screenshot, browser_restart, info_search_web, web_search, search_web,
deploy_expose_port, deploy_apply_deployment, make_manus_page, slide_present

### Editor (6 entries) — Manus FileToolView parity
file_read, file_write, file_str_replace, file_find_in_content, file_find_by_name, text_editor

### Terminal (6 entries)
shell_exec, shell_view, shell_wait, shell_write_to_process, shell_kill_process, code_execute

### WebDev IDE (9 entries)
webdev_init_project, webdev_save_checkpoint, webdev_check_status, webdev_restart_server,
webdev_rollback_checkpoint, webdev_execute_sql, webdev_push_schema, webdev_list_versions,
webdev_add_feature

### No Canvas (correctly excluded)
show_plan, message_notify_user, message_ask_user, generate_image, schedule_task, track_analytics

### Allowed View Types
browser, editor, code, terminal, webDevIDE

## Test Rules
1. Test EVERY tool mapping with `it.each()`
2. Test state accumulation: terminal output persists across multiple shell_exec calls
3. Test screenshot extraction from both tool results AND browser_frame metadata
4. Test view switching: user override via `onSelectView` should stick
5. Test BrowserView with and without screenshots (fallback to text content)
6. When adding a new tool: add to TOOL_VIEW_MAP FIRST, write test, verify mapping
