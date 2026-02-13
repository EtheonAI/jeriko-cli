# Verified Manus Sandbox-Runtime API (from OpenAPI spec on port 8330)

## Services Running
- Port 8330: `start_server` (sandbox-runtime, public)
- Port 9330: `start_server` (sandbox-runtime, internal/localhost only)
- Port 8329: `node` (code-server)
- Port 8333: Neko (WebRTC remote desktop)

## Actual API Routes (Verified)

### File Operations
- `GET /file` — Read file (requires auth, returns 401 without token)
- `POST /file/batch_read` — Batch read multiple files
- `POST /file/upload_to_s3` — Upload file to S3
- `POST /file/upload_files_to_s3` — Upload multiple files to S3
- `POST /file/store_parallel_tasks_result` — Store parallel task results
- `POST /file/files_exist` — Check if files exist
- `POST /file/multipart_upload_to_s3` — Multipart upload

### Text Editor (UNIFIED endpoint)
- `POST /text_editor` — Single endpoint for ALL file operations
  - Commands: view, create, write, str_replace, multi_edit, find_content, find_file, glob, grep
  - NOT separate /files/read, /files/write endpoints

### Terminal (PTY-based)
- `GET /terminal/{terminal_id}/view` — View terminal output
- `POST /terminal/{terminal_id}/write` — Write to terminal (text + optional enter)
- `POST /terminal/{terminal_id}/kill` — Kill terminal process
- `POST /terminal/{terminal_id}/reset` — Reset terminal
- `POST /terminal/reset-all` — Reset all terminals

### Browser
- `POST /browser/action` — Single endpoint for ALL browser actions
  - Actions via BrowserAction union type: browser_navigate, browser_view, browser_screenshot, browser_click, browser_input, browser_press_key, browser_scroll_up, browser_scroll_down, browser_scroll, browser_select_option, browser_console_exec, browser_console_view, browser_save_image, browser_find_keyword, browser_upload_file, browser_fill_form, browser_move_mouse, browser_get_mouse_position, browser_restart
  - Includes screenshot_presigned_url for uploading screenshots to S3
- `GET /browser/status` — Get browser status

### WebDev / Deploy
- `POST /webdev/init_project` — Initialize project (requires project_name, project_title, project_config)
- `POST /webdev/database` — Database operations (push, pull, query)
- `POST /webdev/config` — Configure webdev project
- `POST /webdev/restart` — Restart dev server
- `POST /webdev/status` — Get project status
- `POST /webdev/checkpoint` — Create checkpoint
- `POST /webdev/rollback` — Rollback to checkpoint
- `POST /webdev/git-push` — Push to git
- `POST /deploy/create-webdev-project` — Create deploy project
- `POST /deploy/zip-and-upload` — Zip and upload for deployment
- `POST /deploy/switch-version` — Switch deployment version

### Database Config
- `ProjectDatabaseConfig` has ONE field: `connection_string` (nullable string)
- This is the actual `mysql://` connection string passed from the host to the sandbox
- The sandbox-runtime writes it as `DATABASE_URL` in the project's .env

### Other
- `POST /code-server/auth` — Code-server authentication
- `GET /code-server/pre-auth` — Code-server pre-auth
- `GET /neko/pre-auth` — Neko pre-auth
- `GET /vnc/pre-auth` — VNC pre-auth
- `POST /init-sandbox` — Initialize sandbox
- `GET /healthz` — Health check
- `POST /config/set-env` — Set environment variables
- `POST /slide/*` — Slide operations
- `POST /skills/*` — Skills operations
- `POST /gmail/*` — Gmail operations
- `POST /outlook/*` — Outlook operations
- `POST /image/rmbg` — Remove background from image
- `POST /search_image/upload` — Upload search image

## Key Architecture Insights

1. **NOT E2B** — This is a custom VM with a compiled Python binary (`start_server`)
2. **Terminal is PTY-based** — Uses terminal IDs, write/view/kill pattern (not one-shot shell exec)
3. **File operations use a unified `/text_editor` endpoint** — Not separate REST endpoints
4. **Browser uses a single `/browser/action` endpoint** — With a union type for all actions
5. **Database connection string is passed from host** — Via `ProjectDatabaseConfig.connection_string`
6. **The `DATABASE_URL` env var is a UUID** — But `drizzle-orm/mysql2` receives the actual `mysql://` string via the runtime's `/webdev/database` endpoint
7. **Screenshots are uploaded to S3** — Via presigned URLs, not returned inline
8. **Live browser view is via Neko WebRTC** — Port 8333, not screenshot streaming
