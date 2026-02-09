# services/sandbox — Testing Rules

## What This Is
E2B sandbox management: create/destroy sandboxes, code execution, shell execution, file operations, browser control API.

## What to Test

### Sandbox Lifecycle (P0)
1. Create sandbox → returns sandbox ID
2. Destroy sandbox → cleanup confirmed
3. Timeout → auto-destroy

### Code Execution (P0)
1. Python code → correct output
2. JavaScript code → correct output
3. Syntax error → error response (not crash)
4. Timeout → graceful termination
5. Infinite loop → timeout protection

### Browser Control API (P1)
1. `ALLOWED_BROWSER_ACTIONS` allowlist enforced
2. Valid actions: navigate, click, scroll, screenshot, key_press
3. Invalid actions → 400
4. Browser controller on port 9821 inside sandbox
5. Screenshot returned as base64

### File Operations (P1)
1. Write file → read file → same content
2. List files → correct listing
3. Path traversal rejected (/etc/passwd)

### Security
1. Only allowed actions pass allowlist
2. File paths validated
3. Code execution sandboxed (can't access host)

## Gotchas
- E2B_API_KEY must be in `.env`
- Browser controller: `pip install playwright && playwright install chromium && playwright install-deps chromium`
- `sandbox_files` DB table needs defaults: `is_directory=false`, `version=1`, `created_at=now()`, `updated_at=now()`
- Uses `createService` + `typedRoute` + Zod schemas pattern
