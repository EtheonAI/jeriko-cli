# E2B Research Notes

## Sandbox Lifecycle (from docs)
- Default timeout: 5 minutes
- Max running time: 24h (Pro), 1h (Base)
- Can change timeout at runtime with `set_timeout()`
- Can retrieve info: sandboxId, templateId, name, metadata, startedAt, endAt
- Can kill sandbox anytime with `kill()`
- Persistence: can pause and resume from same state

## Key E2B Packages
- `@e2b/code-interpreter` (JS) / `e2b-code-interpreter` (Python) - main SDK
- `@e2b/desktop` - desktop sandbox with browser, screen streaming

## From Manus Blog
- Manus uses 27 different tools inside E2B
- E2B provides full virtual computer (not just code execution)
- Uses Firecracker microVMs (ephemeral, lightweight)
- Agents can run Python, JavaScript, Bash
- Sandboxes can run for hours in persistent sessions
- Paid users: save info in sandbox for up to 14 days
- Tools: Chromium browser, terminal commands, filesystem
- Can pause and resume sandbox sessions
- Self-hosted E2B on their machines

## Still need to research:
- [ ] E2B persistence (pause/resume) API
- [ ] E2B filesystem API (read/write/upload/download)
- [ ] E2B terminal/shell API
- [ ] E2B Desktop sandbox (browser/screenshot)
- [ ] E2B streaming capabilities
- [ ] E2B environment variables
- [ ] E2B connect to running sandbox

## E2B Commands API
- `sandbox.commands.run('ls -l')` - run terminal commands
- Streaming: pass `onStdout` / `onStderr` callbacks (JS) or `on_stdout` / `on_stderr` (Python)
- Background commands: pass `background` option to `commands.run()`
- Returns result with stdout, stderr, exit code

## E2B Filesystem API
- `sandbox.files.read('/path/to/file')` - read files
- `sandbox.files.write('/path/to/file', 'content')` - write single file
- `sandbox.files.write([{path, data}, ...])` - write multiple files
- Upload/download also available

## E2B Persistence API
- `sandbox.betaPause()` - pause sandbox (saves filesystem + memory)
- `Sandbox.connect(sandboxId)` - resume paused sandbox
- `Sandbox.betaCreate({autoPause: true})` - auto-pause on timeout
- Pause: ~4s per 1 GiB RAM; Resume: ~1s
- Paused sandboxes can be listed and killed

## E2B Desktop Sandbox (for browser)
- Separate package: `e2b-desktop` (Python) / `@e2b/desktop` (JS)
- Has Chromium browser built-in
- Can take screenshots: `desktop.screenshot()`
- Can stream desktop screen
- Mouse and keyboard control
- Window control

## E2B Desktop Sandbox Python SDK (v1.6.3)
The Desktop Sandbox extends the base Sandbox with GUI capabilities:

### Constructor
```python
from e2b_desktop import Sandbox
desktop = Sandbox(
    resolution=(1024, 768),  # default
    dpi=96,                  # default
    template="desktop",      # default
    timeout=300,             # seconds
    metadata={},
    envs={},
    api_key=None,            # defaults to E2B_API_KEY env var
    sandbox_id=None,         # to reconnect
)
```

### Key Methods
- `desktop.screenshot(format="bytes"|"stream")` - take screenshot
- `desktop.left_click(x, y)` / `double_click` / `middle_click`
- `desktop.scroll(direction, amount)`
- `desktop.move_mouse(x, y)`
- `desktop.write(text)` - type text at cursor
- `desktop.press(key)` - press keyboard key
- `desktop.drag(from, to)`
- `desktop.open(file_or_url)` - open file/URL in default app
- `desktop.get_screen_size()` - returns (width, height)
- `desktop.get_cursor_position()` - returns (x, y)

### Streaming
- `desktop.stream.start()` - start screen streaming
- `desktop.stream.get_url()` - get stream URL (can embed in iframe)
- `desktop.stream.get_url(view_only=True)` - read-only stream
- `desktop.stream.stop()` - stop streaming
- Password protection available via `require_auth=True`

### Inherits from base Sandbox
- `desktop.commands.run(cmd)` - run terminal commands
- `desktop.files.read(path)` / `desktop.files.write(path, content)`
- `desktop.betaPause()` / `Sandbox.connect(id)`

## E2B Environment Variables
- Set globally: `Sandbox.create(envs={"KEY": "value"})`
- Set per-command: `sandbox.commands.run("cmd", envs={"KEY": "val"})`
- Set per-code: `sandbox.runCode("code", envs={"KEY": "val"})`
- Default vars: E2B_SANDBOX, E2B_SANDBOX_ID, E2B_TEAM_ID, E2B_TEMPLATE_ID

## Connect to Running Sandbox
```python
from e2b_code_interpreter import Sandbox
sandbox = Sandbox.connect(sandbox_id)
# Now use sandbox normally
```

## Manus Sandbox Architecture (from official blog)

Manus Sandbox is a fully isolated cloud VM allocated per task. Key details:

### What's in the Sandbox
1. User-uploaded attachments
2. Files/artifacts created by Manus during execution
3. Configurations (tokens, API keys uploaded by users or assigned by Manus)

### Sandbox Lifecycle
- **Create**: On demand for new session
- **Sleep/Awake**: Auto-sleeps when inactive, auto-wakes when needed. Files persist across sleep/wake
- **Recycle/Recreate**: Sleeping sandbox recycled after 7 days (free) / 21 days (Pro). New sandbox auto-created with restored artifacts

### Key Architecture Points
- Each sandbox is a full VM with: networking, file system, browser, software tools
- Runs on virtualization platform (E2B Firecracker microVMs)
- 24/7 execution without consuming local resources
- Zero Trust security - full control inside sandbox (root access, etc.)
- Operations only affect that sandbox
- If unrecoverable error: auto-creates new sandbox

### How Manus Uses E2B (from blog + observation)
1. **Backend (Python)** creates/connects to E2B sandbox per session
2. **Backend** executes tools INSIDE the sandbox:
   - `sandbox.commands.run()` for shell/terminal
   - `sandbox.files.read/write()` for file operations
   - Desktop sandbox for browser (Chromium) with screenshots
   - `sandbox.stream.start()` + `sandbox.stream.get_url()` for live browser streaming
3. **Backend** streams tool results back via SSE to frontend
4. **Frontend (Next.js)** renders:
   - Browser view: embeds the E2B desktop stream URL in an iframe OR shows screenshots
   - Terminal view: shows command output
   - File/code views: shows file contents
   - Canvas panel: switches between views based on active tool
5. **Session persistence**: sandbox ID stored in DB, reconnect with `Sandbox.connect(id)`

## Manus Official Tool List (29 tools from leaked gist)

### Communication
1. message_notify_user - send info to user (no response needed)
2. message_ask_user - ask user question (waits for response)

### File Operations (executed INSIDE E2B sandbox)
3. file_read - read file (path, start_line, end_line, sudo)
4. file_write - write/append file (path, content, append, sudo)
5. file_str_replace - find/replace in file
6. file_find_in_content - grep-like search
7. file_find_by_name - find files by name

### Shell/Terminal (executed INSIDE E2B sandbox)
8. shell_exec - execute command (id, exec_dir, command)
9. shell_view - view shell session output
10. shell_wait - wait for process
11. shell_write_to_process - send stdin input
12. shell_kill_process - kill process

### Browser (executed INSIDE E2B sandbox via Chromium)
13. browser_view - view current page
14. browser_navigate - go to URL
15. browser_restart - restart browser
16. browser_click - click element (index or coordinates)
17. browser_input - type text into element
18. browser_move_mouse - move cursor
19. browser_press_key - press keyboard key
20. browser_select_option - select dropdown option
21. browser_scroll_up - scroll up
22. browser_scroll_down - scroll down
23. browser_console_exec - execute JS in console
24. browser_console_view - view console output

### Search
25. info_search_web - web search (query, date_range)

### Deployment
26. deploy_expose_port - expose local port
27. deploy_apply_deployment - deploy app
28. make_manus_page - create Manus page

### Control
29. idle - enter standby

## KEY INSIGHT: All tools execute INSIDE the E2B sandbox
The backend Python server:
1. Receives tool call from LLM
2. Routes to E2B sandbox for execution
3. Returns result to LLM
4. Streams events to frontend

The browser tools control a Chromium instance INSIDE the E2B sandbox.
The shell tools execute commands INSIDE the E2B sandbox.
The file tools read/write files INSIDE the E2B sandbox.

## Key Architecture Insights from E2B Blog

1. Manus is NOT a single LLM agent - it's a multi-agent coordination system
   - Planner agent decomposes prompts into subtasks
   - Executor agents carry them out using tools
   
2. E2B provides Firecracker microVMs (not Docker containers)
   - Full OS, not just containers
   - Can install apps, Python packages, etc.
   - Spin up in ~150ms
   
3. Each user gets a separate sandbox instance
   - Persistent sessions that can run for hours
   - Can pause and resume (e.g., waiting for user credentials)
   - Paid users: save info for up to 14 days
   
4. Tools span: Chromium browser, terminal commands, filesystem operations
   - 27 different tools used inside the sandbox
   
5. Manus self-hosts E2B on their own machines

6. KEY QUOTE: "Manus doesn't just run some pieces of code. It uses 27 different tools, and it needs E2B to have a full virtual computer to work as a real human."
