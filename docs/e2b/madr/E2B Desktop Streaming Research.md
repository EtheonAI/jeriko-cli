# E2B Desktop Streaming Research

## KEY FINDING: E2B Desktop has a LIVE STREAMING URL

From the E2B Desktop GitHub README:

### Python SDK
```python
desktop.stream.start(
    window_id=desktop.get_current_window_id(),  # if not provided the whole desktop will be streamed
    require_auth=True
)
auth_key = desktop.stream.get_auth_key()
stream_url = desktop.stream.get_url(auth_key=auth_key)
```

### JavaScript SDK
```js
await desktop.stream.start({
  windowId: await desktop.getCurrentWindowId(),
  requireAuth: true,
})
const authKey = desktop.stream.getAuthKey()
const streamUrl = desktop.stream.getUrl({ authKey })
```

## This means:
1. E2B Desktop provides a LIVE STREAM URL that can be embedded in an iframe
2. The stream shows the desktop/browser in real-time
3. Authentication is handled via auth keys
4. You can stream a specific window (e.g., Chromium) or the whole desktop
5. The frontend can directly embed this URL — no need for screenshot polling!

## Need to research:
- [ ] What protocol does the stream use? (WebRTC? VNC/noVNC? WebSocket?)
- [ ] Is there a JavaScript/frontend SDK for E2B Desktop?
- [ ] How does Manus use this — iframe embed or screenshot polling?


## CONFIRMED: E2B Desktop uses noVNC for streaming

From the E2B Desktop template docs:

### The streaming stack:
1. **Xvfb** - Virtual framebuffer (X server) running at `:0` with 1024x768x24
2. **XFCE4** - Desktop environment running on the virtual display
3. **x11vnc** - VNC server on port 5900, sharing the X display
4. **noVNC** - WebSocket-to-VNC proxy on port **6080**, serving the noVNC HTML client

### The start_command.sh:
```bash
# Start Xvfb
Xvfb $DISPLAY -ac -screen 0 1024x768x24 -nolisten tcp &
# Start XFCE session
startxfce4 &
# Start VNC server
x11vnc -bg -display $DISPLAY -forever -wait 50 -shared -rfbport 5900 -nopw
# Start noVNC server
cd /opt/noVNC/utils && ./novnc_proxy --vnc localhost:5900 --listen 6080 --web /opt/noVNC --heartbeat 30 &
```

### What this means for the frontend:
- The `stream.getUrl()` method returns a URL pointing to the noVNC web client on port 6080
- This URL can be **embedded directly in an iframe** on the frontend
- The noVNC client handles all the WebSocket-to-VNC communication
- The frontend does NOT need to poll for screenshots — it gets a LIVE VIDEO STREAM
- The `view_only=True` option disables user interaction (read-only view)
- The `auth_key` provides security for the stream

### E2B SDK `stream` API:
- `desktop.stream.start()` - Starts the noVNC stream (can target a specific window)
- `desktop.stream.stop()` - Stops the stream
- `desktop.stream.get_url(auth_key=...)` - Returns the embeddable URL
- `desktop.stream.get_auth_key()` - Returns the auth key for secure access

### How Manus likely uses this:
1. Backend creates DesktopSandbox
2. Backend calls `desktop.stream.start(require_auth=True)`
3. Backend gets `auth_key` and `stream_url`
4. Backend sends `stream_url` to frontend via SSE event (e.g., `sandbox_info`)
5. Frontend embeds the `stream_url` in an iframe → LIVE BROWSER VIEW
6. Backend also takes screenshots for the LLM to "see" the page
7. The LLM controls the browser via the Python SDK (click, type, navigate)
8. The user sees all actions live in the iframe

### E2B JavaScript SDK (@e2b/desktop):
- There IS a JavaScript/TypeScript SDK: `npm install @e2b/desktop`
- It has the same `stream.start()`, `stream.getUrl()`, `stream.getAuthKey()` methods
- This means the FRONTEND (Next.js) could also create/connect to sandboxes directly
- But for security, the backend should manage sandbox creation and pass the stream URL

### The `@e2b/desktop` npm package:
```typescript
import { Sandbox } from '@e2b/desktop'

const desktop = await Sandbox.create()
await desktop.stream.start({ requireAuth: true })
const authKey = desktop.stream.getAuthKey()
const streamUrl = desktop.stream.getUrl({ authKey })
// streamUrl can be embedded in an iframe
```
