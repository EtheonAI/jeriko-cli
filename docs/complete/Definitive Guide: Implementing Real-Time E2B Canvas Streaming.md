# Definitive Guide: Implementing Real-Time E2B Canvas Streaming

This document provides a complete, focused analysis of your current architecture and the final implementation steps required to achieve true, real-time streaming for your Browser and Terminal canvas views. 

### Executive Summary: The Core Issue

**Your current implementation does not stream the E2B session.** It simulates it by sending a single snapshot (a screenshot or terminal output) back to the frontend *after* a tool action is complete. This is why the canvas feels static and not "live".

- **Current Flow:** `Frontend -> Python Backend -> HTTP POST to E2B -> E2B runs command -> E2B returns JSON with screenshot -> Python Backend sends SSE to Frontend`
- **The Flaw:** This is a series of one-shot requests. There is no persistent connection to the E2B sandbox to receive real-time updates as they happen.

### The Fix: True Streaming Architecture

To achieve a live view, we must refactor to a persistent streaming architecture. This involves two key changes:

1.  **E2B Streaming Subscription:** The Python backend will use E2B's SDK to subscribe to `on_screenshot` and `on_stdout` events directly from the sandbox. This provides a continuous stream of data.
2.  **Backend-to-Frontend WebSocket:** A WebSocket will be established between your Python backend and the frontend. The backend will act as a proxy, forwarding the screenshot and terminal data received from E2B directly to the frontend over this WebSocket as soon as it arrives.

- **New Flow:** `Frontend <--> WebSocket <--> Python Backend <--> E2B Streaming Connection`

This guide provides the full, production-ready code for this new architecture.

---

## Part 1: Backend Implementation - The Streaming Proxy

This is the most critical part. We will refactor your Python backend to subscribe to E2B's streaming data and forward it to the frontend via a WebSocket. We will use `FastAPI` for the WebSocket endpoint.

### Step 1.1: Add WebSocket and E2B Dependencies

First, ensure your `requirements.txt` includes the necessary libraries:

```
fastapi
uvicorn
websockets
e2b
```

### Step 1.2: Refactor `session.py` for Streaming

Your current `session.py` only creates a sandbox. We need to modify it to handle streaming callbacks. We will add a `WebSocket` parameter to the `get_sandbox` function and attach handlers to the `on_screenshot` and `on_stdout` events.

**File to be refactored:** `session.py`

```python
# refactored/session.py

import asyncio
from e2b import Sandbox
from fastapi import WebSocket
import base64

# In-memory cache for sandboxes
# In a real production app, you would use Redis or a database
_sandboxes = {}

async def get_sandbox(session_id: str, websocket: WebSocket) -> Sandbox:
    """
    Get a sandbox for the session, creating it if it doesn't exist.
    Crucially, it now attaches WebSocket handlers for real-time streaming.
    """
    if session_id in _sandboxes:
        sandbox = _sandboxes[session_id]
        # Re-attach handlers if the sandbox is being reused with a new WebSocket
        sandbox.remove_all_listeners()
    else:
        print(f"Creating new sandbox for session: {session_id}")
        sandbox = Sandbox(template="base")
        _sandboxes[session_id] = sandbox

    # Define the event handlers that will stream data to the frontend

    async def on_screenshot(screenshot_bytes: bytes):
        """Called every time the E2B browser takes a screenshot."""
        print("Screenshot received, sending to frontend...")
        # Encode as base64 and send over WebSocket
        encoded_screenshot = base64.b64encode(screenshot_bytes).decode("utf-8")
        await websocket.send_json({
            "type": "browser_frame",
            "screenshot": f"data:image/png;base64,{encoded_screenshot}",
            # You can add URL and title here if available from another source
        })

    async def on_stdout(output: str):
        """Called every time there is new output in the sandbox's terminal."""
        print(f"Terminal output received: {output}")
        await websocket.send_json({
            "type": "terminal_output",
            "line": output,
        })

    # Attach the handlers to the sandbox instance
    sandbox.on_screenshot(on_screenshot)
    sandbox.on_stdout(on_stdout)

    return sandbox

def cleanup_sandbox(session_id: str):
    """Close and remove the sandbox for a session."""
    if session_id in _sandboxes:
        sandbox = _sandboxes.pop(session_id)
        sandbox.close()
        print(f"Cleaned up sandbox for session: {session_id}")

```

### Step 1.3: Create the WebSocket Endpoint

Now, create a new file `main.py` (or add to your existing FastAPI app) to handle the WebSocket connection. This endpoint will be the real-time bridge between your frontend and the E2B sandbox.

**File to be created:** `main.py`

```python
# main.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from .session import get_sandbox, cleanup_sandbox

app = FastAPI()

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    Handles the WebSocket connection for a given session.
    - Establishes connection.
    - Creates a sandbox with streaming handlers attached to this specific websocket.
    - Keeps the connection alive to stream data from E2B to the client.
    - Cleans up the sandbox on disconnect.
    """
    await websocket.accept()
    print(f"WebSocket connection accepted for session: {session_id}")

    try:
        # Get a sandbox instance. This is where the on_screenshot and on_stdout
        # handlers are attached to *this* specific websocket connection.
        sandbox = await get_sandbox(session_id, websocket)
        print(f"Sandbox ready for session: {session_id}")

        # Keep the connection alive. The magic happens in the E2B event handlers.
        while True:
            # We are just waiting here. The E2B events are what push data.
            # You could also receive messages from the client here if needed.
            await websocket.receive_text() 

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for session: {session_id}")
        # Clean up the sandbox when the user disconnects
        cleanup_sandbox(session_id)
    except Exception as e:
        print(f"An error occurred in the websocket: {e}")
        # Ensure cleanup happens even on unexpected errors
        cleanup_sandbox(session_id)

# You would also have your existing /completion endpoint here
# from .completion import router as completion_router
# app.include_router(completion_router)

```

### Step 1.4: Modify `tool_executor.py`

Your `tool_executor.py` no longer needs to return screenshot data. The streaming connection handles that. The tool calls now just *trigger* the action in E2B, and the result is observed live on the frontend. The return value of the tool call can be a simple confirmation.

**File to be refactored:** `tool_executor.py` (showing only the `browser_action` part)

```python
# refactored/tool_executor.py (partial)

# ... (imports and other functions)

async def browser_action(sandbox_id: str, action: str, params: dict, user_id: str) -> dict:
    """
    Executes a browser action in the sandbox.
    The key change is that it no longer waits for or returns a screenshot.
    It just performs the action. The live screenshot is sent via the WebSocket.
    """
    if not sandbox_id:
        return {"error": "No sandbox available for browser actions."}

    # NOTE: We are NOT getting the sandbox here. We assume it's already running
    # from the WebSocket connection. We are just posting a command to it.
    client = get_http_client()
    base = settings.sandbox_service_url
    headers = _sandbox_headers(user_id)

    # The sandbox service needs to know which browser to control
    params["browser_id"] = "default" # Or however you identify browsers

    resp = await client.post(
        f"{base}/sandboxes/{sandbox_id}/browser/{action}",
        json=params,
        headers=headers,
        timeout=20.0,
    )

    if resp.status_code >= 400:
        return {"error": f"Browser action `{action}` failed: {resp.text}"}

    # Return a simple success message. The result is streamed.
    return {"success": True, "action": action, "params": params}

# ... (rest of the file)
```

---

## Part 2: Frontend Implementation - Consuming the Stream

With the backend now streaming data, the frontend needs to connect to the WebSocket and update the canvas in real-time. We will create a new hook, `useE2BStream`, to manage this connection.

### Step 2.1: Create the `useE2BStream` Hook

This hook will be responsible for establishing the WebSocket connection and updating its state with the latest data received from the backend.

**File to be created:** `hooks/useE2BStream.ts`

```typescript
// hooks/useE2BStream.ts

import { useState, useEffect, useRef } from "react";

export interface E2BStreamState {
  isConnected: boolean;
  latestScreenshot: string | null;
  terminalOutput: string[];
}

export function useE2BStream(sessionId: string | undefined) {
  const [state, setState] = useState<E2BStreamState>({
    isConnected: false,
    latestScreenshot: null,
    terminalOutput: [],
  });

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Connect to the WebSocket endpoint
    const websocketUrl = `ws://localhost:8000/ws/${sessionId}`;
    ws.current = new WebSocket(websocketUrl);

    ws.current.onopen = () => {
      console.log("E2B stream connected");
      setState(prev => ({ ...prev, isConnected: true }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "browser_frame" && data.screenshot) {
        setState(prev => ({ ...prev, latestScreenshot: data.screenshot }));
      }

      if (data.type === "terminal_output" && data.line) {
        setState(prev => ({ 
          ...prev, 
          terminalOutput: [...prev.terminalOutput, data.line]
        }));
      }
    };

    ws.current.onclose = () => {
      console.log("E2B stream disconnected");
      setState(prev => ({ ...prev, isConnected: false }));
    };

    ws.current.onerror = (error) => {
      console.error("E2B stream error:", error);
    };

    // Cleanup on unmount
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [sessionId]);

  return state;
}
```

### Step 2.2: Refactor `use-canvas.ts` to Use the Stream

Now, we update the main `useCanvas` hook. It will no longer manage screenshot or terminal state itself. Instead, it will consume the state from our new `useE2BStream` hook.

**File to be refactored:** `use-canvas.ts`

```typescript
// refactored/use-canvas.ts

import { useE2BStream } from "./hooks/useE2BStream";
// ... other imports

export function useCanvas(messages: UIMessage[]): CanvasState {
  // ... (existing logic to find latestTool, totalToolCalls, etc.)

  // Get the live stream data for the current session
  const { latestScreenshot, terminalOutput, isConnected } = useE2BStream(sandboxId);

  // ... (remove the old useState for browserScreenshot and terminalHistory)
  // ... (remove the old useEffects that were extracting screenshots and terminal output from tool parts)

  // Build canvas state
  if (!latestTool) {
    return { isVisible: false, viewType: "empty", isWorking: false };
  }

  const state: CanvasState = {
    isVisible: true,
    viewType: latestTool.viewType,
    isWorking: latestTool.isWorking,
    // ... (other state properties)
  };

  // Browser view data - now sourced from the live stream
  if (state.viewType === "browser") {
    state.browserScreenshot = latestScreenshot; // <-- From the stream!
    state.browserLoading = !isConnected; // Show loading if WebSocket is not connected
    // ... (rest of browser state, URL can still come from tool args/output)
  }

  // Terminal view data - now sourced from the live stream
  if (state.viewType === "terminal") {
    state.terminalOutput = terminalOutput; // <-- From the stream!
  }

  // ... (rest of the hook)

  return state;
}
```

### Step 2.3: Final Integration in `AgentCanvas`

No major changes are needed in `AgentCanvas.tsx` itself, as it just consumes the state from `useCanvas`. The refactoring we did in the hook is sufficient to pipe the live data to the UI components (`BrowserViewer`, `TerminalOutput`) that are already in place.

---

## Final Architecture and Data Flow

After these changes, your new, truly live architecture will be:

1.  **`AgentCanvas` Mounts:** The `useCanvas` hook is called.
2.  **`useCanvas` -> `useE2BStream`:** The `useE2BStream` hook is called with the `sessionId`.
3.  **WebSocket Connects:** The frontend establishes a WebSocket connection to `ws://localhost:8000/ws/{sessionId}`.
4.  **Backend Creates Sandbox:** The Python backend receives the connection, calls `get_sandbox`, and attaches the `on_screenshot` and `on_stdout` listeners for that specific session.
5.  **User/Agent Triggers Tool:** The agent calls a tool like `browser_navigate`.
6.  **Backend Executes Action:** `tool_executor.py` sends the `navigate` command to the E2B sandbox.
7.  **E2B Streams Data:** As the browser in E2B navigates and renders, it sends a stream of screenshot data to the Python backend via the `on_screenshot` handler.
8.  **Backend Forwards Data:** The `on_screenshot` handler immediately forwards each screenshot over the WebSocket to the frontend.
9.  **Frontend Updates State:** The `useE2BStream` hook receives the new screenshot, updates its state.
10. **Canvas Re-renders:** The `useCanvas` hook gets the new state from `useE2BStream`, and the `AgentCanvas` re-renders with the live screenshot, creating a smooth, real-time video effect.

This completes the full, end-to-end implementation for live canvas streaming.
