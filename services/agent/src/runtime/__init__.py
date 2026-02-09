"""SandboxRuntime abstraction — Phase B of ADR-003."""

from __future__ import annotations

from .direct_sdk import DirectSdkRuntime
from .protocol import SandboxRuntime
from .types import CodeResult, CommandResult

__all__ = [
    "SandboxRuntime",
    "DirectSdkRuntime",
    "CommandResult",
    "CodeResult",
]
