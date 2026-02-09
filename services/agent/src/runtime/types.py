"""Value types returned by SandboxRuntime methods."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CommandResult:
    """Result of running a shell command in the sandbox."""

    stdout: str
    stderr: str
    exit_code: int


@dataclass(frozen=True)
class CodeResult:
    """Result of running code via the sandbox's code interpreter."""

    stdout: str
    stderr: str
    results: list[str]
    error: str | None = None
    exit_code: int | None = None
