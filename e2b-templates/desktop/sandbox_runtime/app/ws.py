"""WebSocket endpoint for push-based terminal output — Manus parity.

Provides:
  WS  /ws?token=<otp>  — bidirectional terminal commands + output push
  GET /ws/token         — issue a one-time token (RSA-signed request)

The orchestrator connects via WebSocket after sandbox init. Terminal output
is pushed as it arrives (via Terminal._read_loop subscriber), eliminating
the need for HTTP polling. Commands (create, write, kill, resize) are sent
as JSON frames from the orchestrator.

Protocol:
  Client → Server (JSON):
    {"type": "terminal.create", "id": "...", "cols": 80, "rows": 24}
    {"type": "terminal.write", "id": "...", "text": "...", "enter": true}
    {"type": "terminal.kill", "id": "..."}
    {"type": "terminal.resize", "id": "...", "cols": 120, "rows": 40}

  Server → Client (JSON):
    {"type": "terminal.output", "id": "...", "data": "..."}
    {"type": "terminal.created", "id": "...", "pid": 123}
    {"type": "terminal.killed", "id": "..."}
    {"type": "error", "message": "..."}
"""

import asyncio
import secrets
import time
import json

from starlette.websockets import WebSocket, WebSocketDisconnect

from .tools.terminal import Terminal, terminals, _get_next_id
from .logger import get_logger

logger = get_logger("ws")

# One-time tokens for WebSocket auth (token → expiry timestamp)
_otp_tokens: dict[str, float] = {}
_OTP_TTL = 30  # seconds


def create_otp_token() -> str:
    """Generate a one-time token for WebSocket authentication."""
    token = secrets.token_urlsafe(32)
    _otp_tokens[token] = time.time() + _OTP_TTL
    # Prune expired tokens
    now = time.time()
    expired = [t for t, exp in _otp_tokens.items() if exp < now]
    for t in expired:
        _otp_tokens.pop(t, None)
    return token


def validate_otp_token(token: str) -> bool:
    """Validate and consume a one-time token."""
    expiry = _otp_tokens.pop(token, None)
    if expiry is None:
        return False
    return time.time() < expiry


def _subscribe_terminal(
    terminal: Terminal,
    ws: WebSocket,
    queues: dict[str, asyncio.Queue],
    tasks: dict[str, asyncio.Task],
) -> None:
    """Subscribe to a terminal's output and forward to WebSocket.

    Tracks the forwarding task so it can be cancelled on disconnect.
    """
    if terminal.id in queues:
        return  # Already subscribed
    q = terminal.subscribe()
    queues[terminal.id] = q

    async def _forward():
        try:
            while True:
                text = await q.get()
                try:
                    await ws.send_json({
                        "type": "terminal.output",
                        "id": terminal.id,
                        "data": text,
                    })
                except (WebSocketDisconnect, RuntimeError):
                    break
        except asyncio.CancelledError:
            pass
        finally:
            terminal.unsubscribe(q)

    task = asyncio.get_event_loop().create_task(_forward())
    tasks[terminal.id] = task


async def ws_endpoint(websocket: WebSocket) -> None:
    """Main WebSocket handler at /ws."""
    # Auth via query param token
    token = websocket.query_params.get("token", "")
    if not validate_otp_token(token):
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    await websocket.accept()
    logger.info("WebSocket client connected")

    # Track subscriber queues and forwarding tasks for cleanup
    queues: dict[str, asyncio.Queue] = {}
    tasks: dict[str, asyncio.Task] = {}

    # Subscribe to all existing terminals
    for tid, terminal in terminals.items():
        _subscribe_terminal(terminal, websocket, queues, tasks)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type", "")

            if msg_type == "terminal.create":
                tid = msg.get("id") or _get_next_id()
                cols = msg.get("cols", 80)
                rows = msg.get("rows", 24)
                shell = msg.get("shell", "/bin/bash")

                if tid in terminals:
                    await websocket.send_json({
                        "type": "terminal.created",
                        "id": tid,
                        "pid": terminals[tid].pid,
                        "exists": True,
                    })
                else:
                    t = Terminal(tid, cols=cols, rows=rows, shell=shell)
                    terminals[tid] = t
                    t.start_reader(asyncio.get_event_loop())
                    # Brief wait for shell prompt
                    await asyncio.sleep(0.2)
                    await websocket.send_json({
                        "type": "terminal.created",
                        "id": tid,
                        "pid": t.pid,
                    })

                # Auto-subscribe to new terminal
                if tid in terminals:
                    _subscribe_terminal(terminals[tid], websocket, queues, tasks)

            elif msg_type == "terminal.write":
                tid = msg.get("id", "default")
                text = msg.get("text", "")
                enter = msg.get("enter", False)
                t = terminals.get(tid)
                if not t:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Terminal {tid} not found",
                    })
                    continue
                if enter:
                    text += "\n"
                t.write(text)

            elif msg_type == "terminal.kill":
                tid = msg.get("id", "default")
                t = terminals.get(tid)
                if t:
                    # Cancel forwarding task before killing terminal
                    fwd_task = tasks.pop(tid, None)
                    if fwd_task:
                        fwd_task.cancel()
                    queues.pop(tid, None)
                    t.kill()
                    del terminals[tid]
                    await websocket.send_json({
                        "type": "terminal.killed",
                        "id": tid,
                    })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Terminal {tid} not found",
                    })

            elif msg_type == "terminal.resize":
                tid = msg.get("id", "default")
                cols = msg.get("cols", 80)
                rows = msg.get("rows", 24)
                t = terminals.get(tid)
                if t:
                    t.resize(cols, rows)
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Terminal {tid} not found",
                    })

            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}",
                })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        # Cancel all forwarding tasks, then unsubscribe queues
        for tid, task in tasks.items():
            task.cancel()
        # Wait briefly for tasks to acknowledge cancellation
        if tasks:
            await asyncio.gather(*tasks.values(), return_exceptions=True)
        for tid, q in queues.items():
            t = terminals.get(tid)
            if t:
                t.unsubscribe(q)
        tasks.clear()
        queues.clear()
