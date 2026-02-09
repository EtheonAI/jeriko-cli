# e2b_manager.py

import asyncio
import structlog
from e2b_code_interpreter import Sandbox
from e2b_desktop import Sandbox as DesktopSandbox
from ..config import settings

logger = structlog.get_logger()

# In-memory cache for active sandbox objects to avoid reconnecting
_active_sandboxes: dict[str, Sandbox | DesktopSandbox] = {}

async def get_sandbox_for_session(session_id: str, user_id: str, use_desktop: bool = True) -> Sandbox | DesktopSandbox | None:
    """
    Gets or creates an E2B sandbox for a given session.
    - Caches the sandbox object in memory for the lifetime of the service.
    - (Future) Could be extended to persist and reconnect to sandbox IDs from a DB.
    """
    if session_id in _active_sandboxes:
        # Basic check to see if it's still alive. E2B SDK handles reconnection.
        try:
            await _active_sandboxes[session_id].keep_alive(1)
            return _active_sandboxes[session_id]
        except Exception:
            logger.warning("Cached sandbox seems to be dead, creating a new one.", session_id=session_id)
            del _active_sandboxes[session_id]

    if not settings.e2b_api_key:
        logger.error("E2B_API_KEY is not set. Cannot create sandbox.")
        return None

    logger.info("Creating new E2B sandbox for session.", session_id=session_id, desktop=use_desktop)

    try:
        sandbox_class = DesktopSandbox if use_desktop else Sandbox
        sandbox = await asyncio.to_thread(
            sandbox_class,
            template="desktop" if use_desktop else "base",
            api_key=settings.e2b_api_key
        )
        _active_sandboxes[session_id] = sandbox
        logger.info("Successfully created new E2B sandbox.", session_id=session_id, sandbox_id=sandbox.id)
        return sandbox
    except Exception as e:
        logger.error("Failed to create E2B sandbox.", error=str(e), session_id=session_id)
        return None

async def close_sandbox_session(session_id: str):
    """Closes and removes a sandbox from the active cache."""
    if session_id in _active_sandboxes:
        logger.info("Closing E2B sandbox for session.", session_id=session_id)
        try:
            await asyncio.to_thread(_active_sandboxes[session_id].close)
        except Exception as e:
            logger.error("Error closing E2B sandbox.", error=str(e), session_id=session_id)
        finally:
            del _active_sandboxes[session_id]
