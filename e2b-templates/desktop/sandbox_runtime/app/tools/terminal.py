"""Terminal (PTY) session management — Manus parity.

Provides endpoints:
  POST /terminal/create
  POST /terminal/{id}/write
  GET  /terminal/{id}/view
  POST /terminal/{id}/kill
  GET  /terminal/{id}/wait
  POST /terminal/{id}/resize
  GET  /terminal/list
"""

import asyncio
import os
import pty
import select
import signal
import struct
import fcntl
import termios
from typing import Any

from fastapi import APIRouter

from ..logger import get_logger
from ..types.schemas import (
    TerminalCreateRequest,
    TerminalWriteRequest,
    TerminalResizeRequest,
)

logger = get_logger("terminal")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")


class Terminal:
    def __init__(
        self,
        terminal_id: str,
        cols: int = 80,
        rows: int = 24,
        shell: str = "/bin/bash",
    ):
        self.id = terminal_id
        self.cols = cols
        self.rows = rows
        self.shell = shell
        self.output = ""
        self.full_output_path = os.path.join(
            HOME, "terminal_full_output", f"{terminal_id}.log"
        )
        self.master_fd: int | None = None
        self.pid: int | None = None
        self.alive = False
        # WebSocket subscriber queues — push-based PTY output
        self._subscribers: set[asyncio.Queue] = set()
        self._reader_task: asyncio.Task | None = None
        self._start(shell, cols, rows)

    def _start(self, shell: str, cols: int, rows: int) -> None:
        master_fd, slave_fd = pty.openpty()
        self.master_fd = master_fd

        # Fork
        child_pid = os.fork()
        if child_pid == 0:
            # Child process — use slave side for stdio
            os.setsid()
            os.close(master_fd)
            # Set window size on slave
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(slave_fd, termios.TIOCSWINSZ, winsize)
            # Redirect stdio to slave
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            if slave_fd > 2:
                os.close(slave_fd)
            # Set env
            env = os.environ.copy()
            env["TERM"] = "xterm-256color"
            env["COLUMNS"] = str(cols)
            env["LINES"] = str(rows)
            env["HOME"] = HOME
            os.chdir(HOME)
            os.execvpe(shell, [shell, "--login"], env)
        else:
            # Parent — keep master side for reading child output
            os.close(slave_fd)
            self.pid = child_pid
            self.alive = True
            # Make master_fd non-blocking
            flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
            fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
            # Ensure output dir exists
            os.makedirs(os.path.dirname(self.full_output_path), exist_ok=True)

    def subscribe(self) -> asyncio.Queue:
        """Subscribe to push-based PTY output. Returns a Queue that receives text chunks."""
        q: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        """Remove a subscriber queue."""
        self._subscribers.discard(q)

    def start_reader(self, loop: asyncio.AbstractEventLoop) -> None:
        """Launch the async read loop that pushes PTY output to subscribers."""
        if self._reader_task is not None:
            return
        self._reader_task = loop.create_task(self._read_loop())

    async def _read_loop(self) -> None:
        """Async task: detect PTY output via add_reader, push to all subscriber queues."""
        loop = asyncio.get_event_loop()
        while self.alive and self.master_fd is not None:
            readable = asyncio.Event()
            try:
                loop.add_reader(self.master_fd, readable.set)
            except (OSError, ValueError):
                break
            try:
                await asyncio.wait_for(readable.wait(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            finally:
                try:
                    loop.remove_reader(self.master_fd)
                except (OSError, ValueError):
                    pass

            # Read all available data
            chunks: list[bytes] = []
            while True:
                try:
                    r, _, _ = select.select([self.master_fd], [], [], 0)
                except (OSError, ValueError):
                    break
                if not r:
                    break
                try:
                    data = os.read(self.master_fd, 65536)
                except (OSError, IOError):
                    break
                if not data:
                    break
                chunks.append(data)

            if chunks:
                text = b"".join(chunks).decode("utf-8", errors="replace")
                self.output += text
                # Append to full output log
                try:
                    with open(self.full_output_path, "a") as f:
                        f.write(text)
                except OSError:
                    pass
                # Push to all subscribers
                for q in list(self._subscribers):
                    try:
                        q.put_nowait(text)
                    except asyncio.QueueFull:
                        pass

    def read_output(self) -> str:
        """Read available output from the PTY.

        When _read_loop is active (WebSocket push mode), the reader task owns
        the file descriptor exclusively. This method just returns the accumulated
        buffer that _read_loop keeps updated. No fd race.

        When _read_loop is NOT active (pure HTTP mode), this method reads from
        the fd directly (original behavior).
        """
        if self._reader_task is not None:
            # Reader loop owns the fd — return accumulated buffer
            return self.output

        if self.master_fd is None:
            return ""
        chunks: list[bytes] = []
        try:
            while True:
                r, _, _ = select.select([self.master_fd], [], [], 0)
                if not r:
                    break
                data = os.read(self.master_fd, 65536)
                if not data:
                    break
                chunks.append(data)
        except (OSError, IOError):
            pass
        if chunks:
            text = b"".join(chunks).decode("utf-8", errors="replace")
            self.output += text
            # Append to full output log
            try:
                with open(self.full_output_path, "a") as f:
                    f.write(text)
            except OSError:
                pass
        return self.output

    def write(self, text: str) -> None:
        """Write text to the PTY."""
        if self.master_fd is None:
            return
        try:
            os.write(self.master_fd, text.encode("utf-8"))
        except (OSError, IOError):
            pass

    def resize(self, cols: int, rows: int) -> None:
        """Resize the PTY."""
        self.cols = cols
        self.rows = rows
        if self.master_fd is not None:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            try:
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except (OSError, IOError):
                pass

    def kill(self) -> None:
        """Kill the terminal process and stop the reader task."""
        self.alive = False
        if self._reader_task is not None:
            self._reader_task.cancel()
            self._reader_task = None
        if self.pid:
            try:
                os.kill(self.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
        self.master_fd = None
        self._subscribers.clear()

    def is_alive(self) -> bool:
        """Check if the child process is still running."""
        if not self.pid:
            return False
        try:
            pid, status = os.waitpid(self.pid, os.WNOHANG)
            if pid != 0:
                self.alive = False
                return False
        except ChildProcessError:
            self.alive = False
            return False
        return True


# Global terminal registry
terminals: dict[str, Terminal] = {}
_next_id = 1


def _get_next_id() -> str:
    global _next_id
    tid = str(_next_id)
    _next_id += 1
    return tid


@router.post("/terminal/create")
async def create_terminal(req: TerminalCreateRequest) -> dict[str, Any]:
    # Use provided ID or auto-generate (Manus parity: orchestrator sends explicit IDs)
    tid = req.id if req.id else _get_next_id()
    # Return existing terminal if ID already exists
    if tid in terminals:
        return {"id": tid, "pid": terminals[tid].pid, "output": "", "exists": True}
    t = Terminal(tid, cols=req.cols, rows=req.rows, shell=req.shell)
    terminals[tid] = t
    # Start push-based reader for WebSocket subscribers
    t.start_reader(asyncio.get_event_loop())
    # Wait briefly for shell prompt
    await asyncio.sleep(0.3)
    output = t.read_output()
    return {"id": tid, "pid": t.pid, "output": output}


@router.post("/terminal/{terminal_id}/write")
async def write_terminal(terminal_id: str, req: TerminalWriteRequest) -> dict[str, Any]:
    t = terminals.get(terminal_id)
    if not t:
        return {"error": f"Terminal {terminal_id} not found"}
    # Append newline when enter=true (Manus parity)
    text = req.text + "\n" if req.enter else req.text
    t.write(text)
    # Brief wait for output
    await asyncio.sleep(0.1)
    output = t.read_output()
    return {"ok": True, "output": output}


@router.get("/terminal/{terminal_id}/view")
async def view_terminal(terminal_id: str, full: bool = False) -> dict[str, Any]:
    t = terminals.get(terminal_id)
    if not t:
        return {"error": f"Terminal {terminal_id} not found"}
    output = t.read_output()
    if full:
        return {"id": terminal_id, "output": output}
    # Return last 5000 chars
    return {"id": terminal_id, "output": output[-5000:] if len(output) > 5000 else output}


@router.post("/terminal/{terminal_id}/kill")
async def kill_terminal(terminal_id: str) -> dict[str, Any]:
    t = terminals.get(terminal_id)
    if not t:
        return {"error": f"Terminal {terminal_id} not found"}
    t.kill()
    del terminals[terminal_id]
    return {"ok": True, "id": terminal_id}


@router.get("/terminal/{terminal_id}/wait")
async def wait_terminal(
    terminal_id: str,
    timeout: int = 30,
    pattern: str | None = None,
) -> dict[str, Any]:
    t = terminals.get(terminal_id)
    if not t:
        return {"error": f"Terminal {terminal_id} not found"}

    # Poll until output stabilizes or pattern found
    stable_count = 0
    last_output = ""
    elapsed = 0.0
    interval = 0.5

    while elapsed < timeout:
        await asyncio.sleep(interval)
        elapsed += interval
        current = t.read_output()

        if pattern and pattern in current:
            return {"id": terminal_id, "output": current[-5000:], "matched": pattern}

        if current == last_output:
            stable_count += 1
            if stable_count >= 3:
                break
        else:
            stable_count = 0
        last_output = current

    output = t.read_output()
    return {
        "id": terminal_id,
        "output": output[-5000:] if len(output) > 5000 else output,
        "timedOut": elapsed >= timeout,
    }


@router.post("/terminal/{terminal_id}/resize")
async def resize_terminal(terminal_id: str, req: TerminalResizeRequest) -> dict[str, Any]:
    t = terminals.get(terminal_id)
    if not t:
        return {"error": f"Terminal {terminal_id} not found"}
    t.resize(req.cols, req.rows)
    return {"ok": True, "cols": req.cols, "rows": req.rows}


@router.get("/terminal/list")
async def list_terminals() -> dict[str, Any]:
    result = []
    for tid, t in terminals.items():
        result.append({
            "id": tid,
            "pid": t.pid,
            "alive": t.is_alive(),
            "cols": t.cols,
            "rows": t.rows,
        })
    return {"terminals": result}
