# The A-to-Z Guide to E2B Integration: Manus Architecture vs. Your Code

This report provides a comprehensive, segment-by-segment architectural guide to correctly integrating E2B for a powerful, persistent agent sandbox, mirroring the Manus architecture. It directly contrasts the documented, ideal E2B implementation with your current codebase, providing concrete, code-level fixes for each identified gap.

The fundamental architectural misunderstanding in your current implementation is the separation between your main agent service and a non-existent "sandbox service." Your `tool_executor.py` makes HTTP requests to `http://localhost:4012` for every file, shell, and browser operation, but you have no service running there to handle these requests. 

The Manus architecture, and the correct approach, is to have a **single, stateful backend service** (your FastAPI application) that directly integrates the E2B Python SDK. This service creates or connects to an E2B sandbox at the start of a session and holds the `sandbox` object in memory. The agent's tool execution logic then calls the methods of this object directly (e.g., `sandbox.commands.run()`, `sandbox.files.write()`, `desktop.screenshot()`) instead of making internal HTTP calls to itself.

This guide will walk you through correcting this, segment by segment.

---

## Segment 1: The Core Architectural Flaw

The central issue is that your tool execution logic is designed to communicate with a separate microservice that doesn't exist. This is the root cause of why no file, shell, or browser tools work.

### What the Research Shows (Manus & E2B)

A stateful Python application holds the connection to the E2B sandbox. The agent loop, running in the same process, calls functions that have direct access to the E2B `Sandbox` object.

```python
# Ideal Architecture (Simplified)

from e2b_code_interpreter import Sandbox

# 1. Sandbox is created/connected at session start
sandbox = Sandbox(template="base")

def agent_loop(prompt):
    # ... LLM generates a tool call ...
    tool_name = "shell_exec"
    tool_input = {"command": "ls -l"}

    # 2. Tool executor directly uses the sandbox object
    execute_tool(tool_name, tool_input, sandbox)

def execute_tool(name, args, sandbox_instance):
    if name == "shell_exec":
        # 3. Direct SDK call
        exec_result = sandbox_instance.commands.run(args["command"])
        # ... return result

# Close sandbox at session end
sandbox.close()
```

### What Your Code Does

Your `tool_executor.py` acts as an HTTP client, attempting to POST to another service for every operation.

```python
# Your tool_executor.py (Problem)

async def sandbox_shell_operation(sandbox_id: str, user_id: str, operation: str, params: dict):
    # This makes an HTTP call to a service that doesn't exist.
    resp = await client.post(
        f"{base}/sandboxes/{sandbox_id}/shell",
        json={"command": full_command, ...}
    )
    # ...
```

### The Fix: Refactor `tool_executor.py`

You must eliminate the internal HTTP calls and replace them with direct calls to the E2B Python SDK. This involves modifying `tool_executor.py` to accept the `sandbox` object and use its methods.

**Action:** Rewrite `tool_executor.py` and `session.py` to manage and use the E2B SDK objects directly within the FastAPI application lifecycle.

---

## Segment 2: Sandbox Lifecycle & Session Persistence

Correctly managing the sandbox lifecycle—creating, connecting, and persisting—is crucial for a seamless user experience and avoiding unnecessary costs.

### What the Research Shows (Manus & E2B)

1.  **Creation**: A new sandbox is created at the beginning of a new user session if no active sandbox exists for that session.
2.  **Persistence**: The `sandbox_id` is saved in the database, associated with the `session_id`.
3.  **Reconnection**: For subsequent requests within the same session, the backend uses `Sandbox.connect(sandbox_id)` to reconnect to the *exact same running sandbox*, preserving its state (filesystem, running processes, etc.).
4.  **Management**: The backend service is responsible for eventually calling `sandbox.close()` when the session truly ends.

### What Your Code Does

-   `session.py`: You correctly define a `SessionContext` that includes `sandbox_id` and have caching logic.
-   `completion.py`: Your `setup_session_context` function correctly attempts to get or create a session.
-   **The Gap**: The logic to actually *create* the E2B sandbox and store its ID is missing. You have a placeholder for `sandbox_id` but never call `Sandbox()` or `Sandbox.connect()`.

### The Fix: Integrate Sandbox Management in `session.py`

Update your `setup_session_context` function to handle the E2B connection.

```python
# In your session.py or a new e2b_manager.py

from e2b_code_interpreter import Sandbox
from e2b_desktop import Sandbox as DesktopSandbox # For browser

# In-memory cache for active sandbox objects
_active_sandboxes = {}

async def get_or_create_sandbox_session(session_id: str, user_id: str, use_desktop: bool = False) -> Sandbox | DesktopSandbox:
    if session_id in _active_sandboxes:
        # You might want to check if it's still connected
        return _active_sandboxes[session_id]

    # Check DB for a persisted sandbox_id for this session
    # persisted_sandbox_id = await get_persisted_sandbox_id_from_db(session_id)

    sandbox_class = DesktopSandbox if use_desktop else Sandbox

    # if persisted_sandbox_id:
    #     try:
    #         sandbox = sandbox_class.connect(persisted_sandbox_id)
    #         _active_sandboxes[session_id] = sandbox
    #         return sandbox
    #     except Exception:
    #         # Handle connection error, maybe create a new one
    #         pass

    # Create a new one
    sandbox = sandbox_class(template='base' if not use_desktop else 'desktop', api_key=settings.e2b_api_key)
    _active_sandboxes[session_id] = sandbox

    # Persist sandbox.id in your DB against the session_id
    # await save_sandbox_id_to_db(session_id, sandbox.id)

    return sandbox
```

Your `completion.py`'s `setup_session_context` should then call this function to get a live sandbox object and pass it to the `ExecutionContext`.

---

## Segment 3: Tool Execution (Shell, Files, Code)

This is the implementation of the fix from Segment 1.

### What the Research Shows (Manus & E2B)

-   **Shell**: `sandbox.commands.run(command, on_stdout=..., on_stderr=...)` is used for both one-off commands and streaming terminal output.
-   **Files**: `sandbox.files.read(path)` and `sandbox.files.write(path, content)` are used for all file I/O.
-   **Code**: `sandbox.code.run(code, language=...)` is used to execute code snippets.

### What Your Code Does

As established, your code makes `httpx` calls for these operations.

### The Fix: A Correct `execute_tool` Implementation

Your `tool_executor.py` needs to be rewritten to use the live `sandbox` object.

```python
# In tool_executor.py

# The context now includes the live sandbox object
@dataclass
class ExecutionContext:
    user_id: str
    session_id: str
    sandbox: Sandbox | DesktopSandbox | None = None

async def execute_tool(name: str, tool_input: dict, ctx: ExecutionContext) -> dict:
    if not ctx.sandbox:
        return {"error": "Sandbox not available for this session."}

    # --- Shell Operations ---
    if name == "shell_exec":
        # The E2B SDK's run method returns a result object
        exec_result = await ctx.sandbox.commands.run(
            tool_input["command"],
            cwd=tool_input.get("exec_dir", "/home/user")
        )
        return {
            "stdout": exec_result.stdout,
            "stderr": exec_result.stderr,
            "exit_code": exec_result.exit_code
        }

    # --- File Operations ---
    if name == "file_write":
        await ctx.sandbox.files.write(tool_input["path"], tool_input["content"])
        return {"success": True, "path": tool_input["path"]}

    if name == "file_read":
        content = await ctx.sandbox.files.read(tool_input["path"])
        return {"content": content}

    # ... other tool implementations ...

    return {"error": f"Unknown tool: {name}"}
```

---

## Segment 4: Live Browser & Screenshots

This is one of the most powerful features of E2B and a key part of the Manus experience. It relies on the **E2B Desktop Sandbox**.

### What the Research Shows (Manus & E2B)

1.  **Desktop Sandbox**: Manus uses the E2B Desktop Sandbox, which includes a pre-installed Chromium browser and a virtual display.
2.  **Browser Control**: The backend Python code uses an E2B `DesktopSandbox` object to control the browser (navigate, click, type, scroll) and take screenshots (`desktop.screenshot()`).
3.  **Streaming to Frontend**: The backend receives a screenshot (as base64-encoded PNG bytes) from the `desktop.screenshot()` call. It then sends this data to the frontend via a dedicated SSE event (e.g., `browser_frame`).
4.  **Frontend Rendering**: The frontend's `browser-view.tsx` component listens for this event. When it receives a new screenshot, it updates an `<img>` tag's `src` attribute to display it (`src="data:image/png;base64,..."`).

### What Your Code Does

-   `browser-view.tsx`: Your component is correctly set up to display a screenshot via an `<img>` tag.
-   `use-canvas.ts`: Your hook correctly handles a `browserFrame` event to update the screenshot state.
-   `completion.py`: You have a `browser_frame` SSE event that correctly sends the screenshot.
-   **The Gap**: The `execute_tool` function for browser actions in `tool_executor.py` is, again, making HTTP calls. It never calls the E2B Desktop SDK to perform the action or take the screenshot in the first place. There is no screenshot to send.

### The Fix: Implement Browser Tools with `DesktopSandbox`

You must use `e2b_desktop.Sandbox` and its browser control methods.

```python
# In tool_executor.py, when executing a browser tool

# This assumes ctx.sandbox is a DesktopSandbox instance
from e2b_desktop.desktop import DesktopSandbox

async def execute_browser_tool(name: str, tool_input: dict, ctx: ExecutionContext) -> dict:
    if not isinstance(ctx.sandbox, DesktopSandbox):
        return {"error": "A Desktop Sandbox is required for browser operations."}

    desktop = ctx.sandbox

    if name == "browser_navigate":
        await desktop.open(tool_input["url"])
        # Wait for page to load - a simple sleep is a start, but you'll want more robust logic
        await asyncio.sleep(3)

    elif name == "browser_click":
        await desktop.left_click(x=tool_input["coordinate_x"], y=tool_input["coordinate_y"])
        await asyncio.sleep(1)

    # ... other browser actions ...

    # After EVERY browser action, take a screenshot and return it
    screenshot_b64 = await desktop.screenshot_base64()

    # This dictionary is what gets sent in the 'browser_frame' SSE event
    return {
        "screenshot": screenshot_b64,
        "url": await desktop.get_url(), # You'd need to implement this helper
        "title": await desktop.get_title() # Helper to get page title
    }
```

Your `_stream_agent_response` in `completion.py` is already correctly structured to grab this dictionary from the tool result and put it into a `browser_frame` SSE event. Once `execute_tool` returns the screenshot, the rest of your pipeline will work.

---

## Segment 5: Frontend, SSE, and Canvas Rendering

Your frontend is surprisingly close to correct. The main issues stem from the backend never sending the right data. However, there is a key issue with how you're handling state.

### What the Research Shows (Manus & E2B)

-   **Backend (`completion.py`)**: Emits a stream of distinct SSE event types: `tool_start`, `tool_result`, `content`, `browser_frame`, `sandbox_info`.
-   **Proxy (`agent-proxy.ts`)**: Pumps the raw SSE from the backend and transforms it into the Vercel AI SDK v6 format (`text-delta`, `tool-input-start`, `tool-output-available`, `message-metadata`, etc.).
-   **Processor (`sse-processor.ts`)**: Your processor correctly maps your custom backend events to AI SDK events. The mapping of `browser_frame` and `sandbox_info` to `message-metadata` is the correct pattern.
-   **Canvas Hook (`use-canvas.ts`)**: This hook should listen to the `message.experimental_metadata` field from the AI SDK's `useChat` hook to get the live `browserFrame` and `sandboxId` data and update its local state.

### What Your Code Does

-   Your backend-to-frontend pipeline (`completion.py` -> `agent-proxy.ts` -> `sse-processor.ts`) is well-structured.
-   **The Gap**: Your `use-canvas.ts` hook has a major state management conflict. It derives its state from the `latestTool` prop but also tries to manage its own browser state (`browserUrl`, `browserScreenshot`). These two sources of truth are not synchronized. The `browserFrame` metadata update is received, but it doesn't correctly override the state derived from the historical `latestTool`.

### The Fix: Unify State Management in `use-canvas.ts`

Prioritize the live data from `message.experimental_metadata` and use `useEffect` to sync it with your component's state.

```typescript
// In use-canvas.ts

export function useCanvas() {
  const { messages } = useChat();

  // State for the live browser view
  const [liveBrowserScreenshot, setLiveBrowserScreenshot] = useState<string | null>(null);
  const [liveBrowserUrl, setLiveBrowserUrl] = useState<string>("");

  // Effect to listen to the latest message for live updates
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.experimental_metadata) {
      const meta = lastMessage.experimental_metadata;
      if (meta.browserFrame) {
        setLiveBrowserScreenshot(meta.browserFrame.screenshot);
        setLiveBrowserUrl(meta.browserFrame.url);
      }
    }
  }, [messages]);

  // ... logic to determine if you are viewing a pinned tool or live view ...

  const isLive = !pinnedToolCallId;

  return {
    // ... other props
    browserUrl: isLive ? liveBrowserUrl : pinnedToolBrowserUrl, // Show live or pinned URL
    browserScreenshot: isLive ? liveBrowserScreenshot : pinnedToolScreenshot, // Show live or pinned screenshot
  };
}
```

This ensures that as new `browser_frame` events arrive, your canvas immediately reflects the latest state from the sandbox, creating the 
live browsing experience.

---

## Summary of Key Architectural Changes Required

1.  **Eliminate the Sandbox Microservice Abstraction**: Your FastAPI application should directly import and use the `e2b_code_interpreter` and `e2b_desktop` Python SDKs.

2.  **Implement a Sandbox Manager**: Create a module (`e2b_manager.py` or similar) responsible for creating, connecting to, and caching E2B `Sandbox` objects. Your `completion.py` will call this manager at the start of each session.

3.  **Rewrite `tool_executor.py`**: Change all tool execution functions to accept the live `sandbox` object from the `ExecutionContext` and make direct SDK calls (e.g., `sandbox.commands.run()`, `desktop.screenshot_base64()`).

4.  **Use `DesktopSandbox` for Browser Tools**: Ensure that sessions requiring browser interaction are created with `e2b_desktop.Sandbox`.

5.  **Return Screenshots from Browser Tools**: Every browser tool execution must conclude by taking a screenshot and returning the base64 data in its result dictionary.

6.  **Unify Frontend State in `use-canvas.ts`**: Refactor the hook to prioritize live data from message metadata for the browser view, ensuring real-time updates.

By implementing these changes, you will bridge the significant architectural gap and achieve the robust, interactive, and persistent agent experience you are aiming for, just like Manus.
