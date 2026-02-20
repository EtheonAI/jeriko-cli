# canvas — Testing Rules

## What This Is
Reactive canvas system: browser, editor, code, and terminal views. Driven by tool calls in messages.

## Architecture
- `use-canvas.ts`: Scans messages backwards → `TOOL_VIEW_MAP` → determines active view
- `agent-canvas.tsx`: Renders active view, manages tabs
- `views/browser-view.tsx`: Screenshots, search results, URL bar, Take Control
- `views/editor-view.tsx`: Monaco editor (lazy-loaded), Manus FileToolView parity — filename header + read-only syntax highlighting
- `views/monaco-wrapper.tsx`: Lazy-loaded Monaco component (`React.lazy`), `rubic-dark` theme, 30+ language mappings
- `views/code-view.tsx`: Full IDE — file tree, tabs, ShikiCodeBlock (for webDevIDE)
- `views/terminal-view.tsx`: Shell output accumulation, per-session PTY, rAF scroll debounce, live WS + static fallback

## View Switching Priority (Manus Parity — VERIFIED Feb 2026)
1. **Pinned tool** — User scrubbed timeline to historical tool
2. **View override** — User manually switched tabs (local state)
3. **Latest tool** — Currently executing or most recent (via TOOL_VIEW_MAP)
4. **Sidebar type** — `agentWorkspace.sidebarType` fallback (no tools called yet)
5. **Empty** — No tools or canvas

Two implementations: standalone (`use-canvas.ts`, messages-driven) + Redux-based (`use-canvas-entities.ts`, selectors-driven).

## Terminal Pipeline — Dual Path Architecture (Feb 2026)
- **HTTP (Manus pattern)**: REST polling ~300-600ms. This IS what Manus does (TCP on port 8330).
- **WebSocket push (enhancement)**: Push ~50-100ms via sandbox `/ws` endpoint. Our improvement over Manus.
- `sandbox-executor.ts` tries WS first, falls back to HTTP silently.
- **Lazy WS connection**: `ensureSandboxWs()` on first shell tool call, NOT at sandbox init.
- **PTY fd ownership**: When `_reader_task` active in sandbox, ONLY `_read_loop` reads from fd.

## Editor Pipeline — Monaco (Feb 2026)
- **Confirmed**: Manus uses Monaco for WebDev IDE code tab (Part 4, line 541-542)
- `monaco-wrapper.tsx`: `React.lazy(() => import("@monaco-editor/react"))` — ~2MB lazy-loaded
- Custom `rubic-dark` theme: `#19191a` bg, `#dadada` fg, `#858481` line numbers
- Options: no minimap, fontSize 13, readOnly, automaticLayout
- **MUST use React.lazy()** — direct import adds ~2MB to initial bundle

## File Pipeline (REST only — matches Manus)
- file_read/write/str_replace → POST /text_editor → synchronous response
- Results flow: SSE → use-sse-to-entities → codeViewer.slice → canvas.selectors → EditorView → Monaco

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
