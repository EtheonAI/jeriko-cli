"""SandboxRuntime Protocol — the contract every runtime implementation must satisfy."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from .types import CodeResult, CommandResult


@runtime_checkable
class SandboxRuntime(Protocol):
    """
    Abstract interface for sandbox operations.

    All methods are async. Implementations wrap the underlying SDK calls
    (e.g. asyncio.to_thread for E2B) so callers never need to.

    Method groups:
      - File: read / write
      - Command: run shell commands
      - Code: run code via interpreter
      - Desktop: browser/GUI interactions (DesktopSandbox only)
      - Infra: host exposure, lifecycle, metadata
    """

    # ── File ──────────────────────────────────────────────────

    async def file_read(self, path: str) -> str: ...

    async def file_write(self, path: str, content: str) -> None: ...

    # ── Command ───────────────────────────────────────────────

    async def command_run(
        self,
        command: str,
        *,
        cwd: str | None = None,
        timeout: int | None = None,
    ) -> CommandResult: ...

    # ── Code ──────────────────────────────────────────────────

    async def code_run(
        self, code: str, *, language: str = "python", timeout: int = 30
    ) -> CodeResult: ...

    @property
    def has_code_interpreter(self) -> bool: ...

    # ── Desktop (DesktopSandbox only) ─────────────────────────

    async def desktop_open(self, url: str) -> None: ...

    async def desktop_screenshot(self) -> bytes: ...

    async def desktop_left_click(self, *, x: int, y: int) -> None: ...

    async def desktop_write(self, text: str) -> None: ...

    async def desktop_press(self, key: str) -> None: ...

    async def desktop_move_mouse(self, *, x: int, y: int) -> None: ...

    async def desktop_scroll(
        self, *, x: int, y: int, scroll_x: int, scroll_y: int
    ) -> None: ...

    # ── Infra ─────────────────────────────────────────────────

    def get_host(self, port: int) -> str: ...

    @property
    def sandbox_id(self) -> str: ...

    @property
    def is_desktop(self) -> bool: ...

    async def is_alive(self) -> bool: ...

    async def set_timeout(self, seconds: int) -> None: ...

    async def kill(self) -> None: ...

    def get_stream_url(self) -> str | None: ...
