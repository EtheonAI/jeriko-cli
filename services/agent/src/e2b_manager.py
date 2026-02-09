"""
E2B Sandbox Session Manager — authoritative sandbox lifecycle for the agent.

Responsibilities:
  - In-memory cache of active sandbox objects per session
  - Create / connect / reconnect / timeout / kill lifecycle
  - Async locking to prevent duplicate creates per session
  - DB persistence of sandbox_id → session_id mapping
  - TTL management: warm idle (10m), hibernate reuse (48h), hard max (72h)
  - Graceful degradation when E2B API key is missing

Uses the E2B Python SDK directly — NO HTTP calls to the sandbox microservice.
"""

import asyncio
import time
from dataclasses import dataclass, field

import structlog

from .config import settings
from .db import execute, fetchrow
from .states import SessionState

logger = structlog.get_logger()


# ============================================================
# Types
# ============================================================


@dataclass
class SandboxEntry:
    """Tracks a live sandbox instance and its metadata."""

    sandbox: object  # e2b.Sandbox or e2b_desktop.Sandbox
    sandbox_id: str
    session_id: str
    user_id: str
    is_desktop: bool
    created_at: float = field(default_factory=time.monotonic)
    last_used_at: float = field(default_factory=time.monotonic)
    state: SessionState = SessionState.SESSION_READY

    def touch(self) -> None:
        """Update last-used timestamp."""
        self.last_used_at = time.monotonic()

    @property
    def idle_seconds(self) -> float:
        return time.monotonic() - self.last_used_at

    @property
    def age_seconds(self) -> float:
        return time.monotonic() - self.created_at


# ============================================================
# In-memory cache
# ============================================================

_active_sandboxes: dict[str, SandboxEntry] = {}
_locks: dict[str, asyncio.Lock] = {}


def _get_lock(session_id: str) -> asyncio.Lock:
    """Get or create a per-session lock to prevent duplicate sandbox creates."""
    if session_id not in _locks:
        _locks[session_id] = asyncio.Lock()
    return _locks[session_id]


# ============================================================
# Template Selection
# ============================================================


def select_template(tools: list[str]) -> str:
    """
    Select the appropriate E2B template based on tools in the request.

    Priority:
    1. browser_* → desktop (Playwright + GUI + code interpreter)
    2. code_execute → code-interpreter-v1 (Python REPL)
    3. Other tools → base (lightweight)

    Desktop template has BOTH browser AND code interpreter, so browser
    tools take priority.

    Args:
        tools: List of tool names that will be used in this request

    Returns:
        Template ID from settings (desktop, code-interpreter-v1, or base)
    """
    # Browser tools require desktop template (GUI + Playwright)
    if any(tool.startswith("browser_") for tool in tools):
        return settings.e2b_template_desktop

    # Code execution requires code interpreter
    if "code_execute" in tools:
        return settings.e2b_template_code

    # Everything else uses lightweight base
    return settings.e2b_template_base


# ============================================================
# Public API
# ============================================================


async def get_or_create_sandbox(
    session_id: str,
    user_id: str,
    use_desktop: bool = True,
) -> object | None:
    """
    Get an existing sandbox for a session, or create a new one.

    Returns the E2B Sandbox object (or DesktopSandbox), or None if
    E2B is not configured.

    This is the ONLY entry point for sandbox acquisition. The completion
    route calls this once per request.
    """
    if not settings.e2b_api_key:
        logger.warning("e2b_not_configured", session_id=session_id)
        return None

    lock = _get_lock(session_id)
    async with lock:
        # 1. Check in-memory cache
        entry = _active_sandboxes.get(session_id)
        if entry:
            if await _is_sandbox_alive(entry):
                entry.touch()
                logger.info(
                    "sandbox_cache_hit",
                    session_id=session_id,
                    sandbox_id=entry.sandbox_id,
                    idle_s=round(entry.idle_seconds),
                )
                return entry.sandbox
            else:
                logger.warning(
                    "sandbox_cache_dead",
                    session_id=session_id,
                    sandbox_id=entry.sandbox_id,
                )
                del _active_sandboxes[session_id]

        # 2. Check DB for a persisted sandbox_id and try to reconnect
        persisted_id = await _get_persisted_sandbox_id(session_id)
        if persisted_id:
            sandbox = await _reconnect_sandbox(persisted_id, use_desktop)
            if sandbox:
                sandbox_id = _get_sandbox_id(sandbox)
                entry = SandboxEntry(
                    sandbox=sandbox,
                    sandbox_id=sandbox_id,
                    session_id=session_id,
                    user_id=user_id,
                    is_desktop=use_desktop,
                    state=SessionState.SESSION_READY,
                )
                _active_sandboxes[session_id] = entry
                logger.info(
                    "sandbox_reconnected",
                    session_id=session_id,
                    sandbox_id=sandbox_id,
                )
                return sandbox

        # 3. Create a new sandbox
        sandbox = await _create_sandbox(use_desktop)
        if not sandbox:
            return None

        sandbox_id = _get_sandbox_id(sandbox)

        # Persist to DB
        await _persist_sandbox_id(session_id, sandbox_id)

        entry = SandboxEntry(
            sandbox=sandbox,
            sandbox_id=sandbox_id,
            session_id=session_id,
            user_id=user_id,
            is_desktop=use_desktop,
            state=SessionState.SESSION_READY,
        )
        _active_sandboxes[session_id] = entry

        logger.info(
            "sandbox_created",
            session_id=session_id,
            sandbox_id=sandbox_id,
            desktop=use_desktop,
        )
        return sandbox


def get_sandbox_id_for_session(session_id: str) -> str | None:
    """Get the sandbox ID for a session from the in-memory cache (no I/O)."""
    entry = _active_sandboxes.get(session_id)
    return entry.sandbox_id if entry else None


def get_sandbox_entry(session_id: str) -> SandboxEntry | None:
    """Get the full sandbox entry for a session."""
    return _active_sandboxes.get(session_id)


async def close_sandbox(session_id: str) -> None:
    """Close and remove a sandbox for a session."""
    entry = _active_sandboxes.pop(session_id, None)
    if not entry:
        return

    try:
        await asyncio.to_thread(entry.sandbox.kill)
        logger.info("sandbox_closed", session_id=session_id, sandbox_id=entry.sandbox_id)
    except Exception as e:
        logger.warning(
            "sandbox_close_error",
            session_id=session_id,
            sandbox_id=entry.sandbox_id,
            error=str(e),
        )

    # Clear from DB
    await _clear_persisted_sandbox_id(session_id)

    # Clean up lock
    _locks.pop(session_id, None)


async def reconnect_sandbox(sandbox_id: str, use_desktop: bool = True) -> object | None:
    """Reconnect to a sandbox by its ID (not session-scoped)."""
    return await _reconnect_sandbox(sandbox_id, use_desktop)


async def cleanup_expired_sandboxes() -> int:
    """
    Clean up expired sandboxes based on TTL.
    Called periodically (e.g., every 60s) by a background task.

    Two tiers:
    - Warm idle (10min): Evict from memory but DON'T kill. The sandbox stays
      alive on E2B's side and the sandbox_id stays in DB so we can reconnect
      on the next request (hibernate/reuse within 48h).
    - Hard max lifetime (72h): Actually kill the sandbox — it's too old.

    Returns number of cleaned-up sandboxes.
    """
    cleaned = 0
    to_hibernate: list[str] = []
    to_kill: list[str] = []

    for session_id, entry in list(_active_sandboxes.items()):
        # Hard max lifetime → kill
        if entry.age_seconds > settings.e2b_hard_max_lifetime:
            to_kill.append(session_id)
            continue

        # Warm idle timeout → hibernate (evict from memory, keep alive on E2B)
        if entry.idle_seconds > settings.e2b_warm_idle_ttl:
            to_hibernate.append(session_id)
            continue

    for session_id in to_hibernate:
        entry = _active_sandboxes.pop(session_id, None)
        if entry:
            logger.info(
                "sandbox_hibernated",
                session_id=session_id,
                sandbox_id=entry.sandbox_id,
                idle_s=round(entry.idle_seconds),
            )
            cleaned += 1
        _locks.pop(session_id, None)

    for session_id in to_kill:
        await close_sandbox(session_id)
        cleaned += 1

    if cleaned:
        logger.info("sandbox_cleanup", hibernated=len(to_hibernate), killed=len(to_kill))

    return cleaned


def get_neko_url(sandbox_entry: SandboxEntry) -> str | None:
    """
    Build the Neko WebRTC URL for a sandbox.

    Neko runs on port 8080 inside the sandbox. E2B exposes it via
    the sandbox's public hostname.
    """
    try:
        host = sandbox_entry.sandbox.get_host(8080)
        if host:
            return f"https://{host}"
    except Exception:
        pass
    return None


def get_stream_url(sandbox_entry: SandboxEntry) -> str | None:
    """
    Get the E2B Desktop stream URL if available.
    Falls back to Neko URL.
    """
    # Try E2B Desktop SDK stream first
    try:
        if hasattr(sandbox_entry.sandbox, "stream"):
            stream = sandbox_entry.sandbox.stream
            if hasattr(stream, "get_url"):
                url = stream.get_url()
                if url:
                    return url
    except Exception:
        pass

    # Fall back to Neko
    return get_neko_url(sandbox_entry)


# ============================================================
# Internal helpers
# ============================================================


async def _create_sandbox(use_desktop: bool) -> object | None:
    """Create a new E2B sandbox using Sandbox.create() (SDK v2.13+)."""
    try:
        if use_desktop:
            try:
                from e2b_desktop import Sandbox as DesktopSandbox

                sandbox = await asyncio.to_thread(
                    DesktopSandbox.create,
                    template=settings.e2b_template,
                    timeout=settings.e2b_warm_idle_ttl,
                )
                return sandbox
            except ImportError:
                logger.warning("e2b_desktop_not_installed_falling_back")
                # Fall through to standard sandbox

        from e2b_code_interpreter import Sandbox

        sandbox = await asyncio.to_thread(
            Sandbox.create,
            template=settings.e2b_template if settings.e2b_template else None,
            timeout=settings.e2b_warm_idle_ttl,
        )
        return sandbox

    except Exception as e:
        logger.error("sandbox_create_error", error=str(e), desktop=use_desktop)
        return None


async def _reconnect_sandbox(sandbox_id: str, use_desktop: bool) -> object | None:
    """Reconnect to an existing sandbox by ID (SDK v2.13+: Sandbox.connect(id))."""
    try:
        if use_desktop:
            try:
                from e2b_desktop import Sandbox as DesktopSandbox

                sandbox = await asyncio.to_thread(
                    DesktopSandbox.connect,
                    sandbox_id,
                )
                # Reset timeout on reconnect
                await asyncio.to_thread(
                    sandbox.set_timeout,
                    settings.e2b_warm_idle_ttl,
                )
                return sandbox
            except ImportError:
                pass

        from e2b_code_interpreter import Sandbox

        sandbox = await asyncio.to_thread(
            Sandbox.connect,
            sandbox_id,
        )
        await asyncio.to_thread(sandbox.set_timeout, settings.e2b_warm_idle_ttl)
        return sandbox

    except Exception as e:
        logger.warning(
            "sandbox_reconnect_failed",
            sandbox_id=sandbox_id,
            error=str(e),
        )
        return None


async def _is_sandbox_alive(entry: SandboxEntry) -> bool:
    """Check if a cached sandbox is still responsive."""
    try:
        # Try a lightweight operation to verify the sandbox is alive
        await asyncio.to_thread(
            entry.sandbox.set_timeout,
            settings.e2b_warm_idle_ttl,
        )
        return True
    except Exception:
        return False


def _get_sandbox_id(sandbox: object) -> str:
    """Extract sandbox ID from an E2B sandbox object."""
    # Both Sandbox and DesktopSandbox expose sandbox_id
    if hasattr(sandbox, "sandbox_id"):
        return sandbox.sandbox_id
    if hasattr(sandbox, "id"):
        return sandbox.id
    return str(id(sandbox))


# ============================================================
# DB persistence
# ============================================================


async def _get_persisted_sandbox_id(session_id: str) -> str | None:
    """Look up a persisted sandbox_id for a session."""
    try:
        row = await fetchrow(
            """SELECT sandbox_id FROM agent_sessions
               WHERE id = $1 AND sandbox_id IS NOT NULL""",
            session_id,
        )
        return row["sandbox_id"] if row else None
    except Exception:
        return None


async def _persist_sandbox_id(session_id: str, sandbox_id: str) -> None:
    """Save sandbox_id to the agent_sessions table."""
    try:
        await execute(
            """UPDATE agent_sessions SET sandbox_id = $1, updated_at = NOW()
               WHERE id = $2""",
            sandbox_id,
            session_id,
        )
    except Exception as e:
        logger.warning("sandbox_persist_error", error=str(e))


async def _clear_persisted_sandbox_id(session_id: str) -> None:
    """Clear the sandbox_id from the agent_sessions table."""
    try:
        await execute(
            """UPDATE agent_sessions SET sandbox_id = NULL, updated_at = NOW()
               WHERE id = $1""",
            session_id,
        )
    except Exception:
        pass


# ============================================================
# Startup / Shutdown
# ============================================================


async def shutdown_all_sandboxes() -> None:
    """Close all active sandboxes. Call from app shutdown."""
    sessions = list(_active_sandboxes.keys())
    for session_id in sessions:
        await close_sandbox(session_id)
    logger.info("all_sandboxes_shutdown", count=len(sessions))
