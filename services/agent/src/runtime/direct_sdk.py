"""DirectSdkRuntime — wraps a raw E2B SDK sandbox object behind SandboxRuntime."""

from __future__ import annotations

import asyncio
from typing import Any

from .types import CodeResult, CommandResult


class DirectSdkRuntime:
    """
    SandboxRuntime implementation that delegates to the E2B Python SDK.

    All blocking SDK calls are wrapped in ``asyncio.to_thread`` so callers
    can ``await`` them directly.

    Parameters
    ----------
    sandbox : object
        A live ``e2b.Sandbox``, ``e2b_code_interpreter.Sandbox``,
        or ``e2b_desktop.Sandbox`` instance.
    sandbox_id : str
        The sandbox's unique identifier.
    is_desktop : bool
        Whether *sandbox* is a DesktopSandbox (has mouse/keyboard/screenshot).
    """

    def __init__(self, sandbox: Any, sandbox_id: str, is_desktop: bool) -> None:
        self._sandbox = sandbox
        self._sandbox_id = sandbox_id
        self._is_desktop = is_desktop

    # ── File ──────────────────────────────────────────────────

    async def file_read(self, path: str) -> str:
        return await asyncio.to_thread(self._sandbox.files.read, path)

    async def file_write(self, path: str, content: str) -> None:
        await asyncio.to_thread(self._sandbox.files.write, path, content)

    # ── Command ───────────────────────────────────────────────

    async def command_run(
        self,
        command: str,
        *,
        cwd: str | None = None,
        timeout: int | None = None,
    ) -> CommandResult:
        kwargs: dict[str, Any] = {}
        if cwd is not None:
            kwargs["cwd"] = cwd
        if timeout is not None:
            kwargs["timeout"] = timeout

        raw = await asyncio.to_thread(
            self._sandbox.commands.run, command, **kwargs
        )
        return CommandResult(
            stdout=raw.stdout or "",
            stderr=raw.stderr or "",
            exit_code=raw.exit_code,
        )

    # ── Code ──────────────────────────────────────────────────

    async def code_run(
        self, code: str, *, language: str = "python", timeout: int = 30
    ) -> CodeResult:
        if language == "python" and self.has_code_interpreter:
            execution = await asyncio.to_thread(self._sandbox.run_code, code)
            return CodeResult(
                stdout="\n".join(execution.logs.stdout) if execution.logs.stdout else "",
                stderr="\n".join(execution.logs.stderr) if execution.logs.stderr else "",
                results=[r.text for r in execution.results if r.text] if execution.results else [],
                error=str(execution.error) if execution.error else None,
            )

        # Fallback: write to file and run via shell
        ext_map = {
            "python": "py",
            "javascript": "js",
            "typescript": "ts",
            "bash": "sh",
            "ruby": "rb",
        }
        ext = ext_map.get(language, language)
        file_path = f"/tmp/code_exec.{ext}"
        await self.file_write(file_path, code)

        cmd_map = {
            "python": f"python3 {file_path}",
            "javascript": f"node {file_path}",
            "typescript": f"npx tsx {file_path}",
            "bash": f"bash {file_path}",
            "ruby": f"ruby {file_path}",
        }
        cmd = cmd_map.get(language, f"python3 {file_path}")
        result = await self.command_run(cmd, timeout=timeout)
        return CodeResult(
            stdout=result.stdout,
            stderr=result.stderr,
            results=[],
            exit_code=result.exit_code,
        )

    @property
    def has_code_interpreter(self) -> bool:
        return hasattr(self._sandbox, "run_code")

    # ── Desktop ───────────────────────────────────────────────

    def _require_desktop(self) -> None:
        if not self._is_desktop:
            raise RuntimeError("Desktop operations require a DesktopSandbox.")

    async def desktop_open(self, url: str) -> None:
        self._require_desktop()
        await asyncio.to_thread(self._sandbox.open, url)

    async def desktop_screenshot(self) -> bytes:
        self._require_desktop()
        return await asyncio.to_thread(self._sandbox.screenshot)

    async def desktop_left_click(self, *, x: int, y: int) -> None:
        self._require_desktop()
        await asyncio.to_thread(self._sandbox.left_click, x=x, y=y)

    async def desktop_write(self, text: str) -> None:
        self._require_desktop()
        await asyncio.to_thread(self._sandbox.write, text)

    async def desktop_press(self, key: str) -> None:
        self._require_desktop()
        await asyncio.to_thread(self._sandbox.press, key)

    async def desktop_move_mouse(self, *, x: int, y: int) -> None:
        self._require_desktop()
        await asyncio.to_thread(self._sandbox.move_mouse, x=x, y=y)

    async def desktop_scroll(
        self, *, x: int, y: int, scroll_x: int, scroll_y: int
    ) -> None:
        self._require_desktop()
        await asyncio.to_thread(
            self._sandbox.scroll, x=x, y=y, scroll_x=scroll_x, scroll_y=scroll_y
        )

    # ── Infra ─────────────────────────────────────────────────

    def get_host(self, port: int) -> str:
        return self._sandbox.get_host(port)

    @property
    def sandbox_id(self) -> str:
        return self._sandbox_id

    @property
    def is_desktop(self) -> bool:
        return self._is_desktop

    async def is_alive(self) -> bool:
        try:
            await asyncio.to_thread(self._sandbox.set_timeout, 600)
            return True
        except Exception:
            return False

    async def set_timeout(self, seconds: int) -> None:
        await asyncio.to_thread(self._sandbox.set_timeout, seconds)

    async def kill(self) -> None:
        await asyncio.to_thread(self._sandbox.kill)

    def get_stream_url(self) -> str | None:
        try:
            if hasattr(self._sandbox, "stream"):
                stream = self._sandbox.stream
                if hasattr(stream, "get_url"):
                    url = stream.get_url()
                    if url:
                        return url
        except Exception:
            pass
        return None
