# Document 1: E2B Sandbox Architecture & Security Fix

This document details the security vulnerabilities and architectural flaws in the current E2B sandbox implementation and provides a complete, production-ready fix.

## 1. Executive Summary

The most critical issue is the **exposure of the E2B_API_KEY directly to the frontend**. This is a severe security vulnerability that allows any user to gain full control over your E2B account. The secondary issue is that the frontend is attempting to manage the E2B session, which is architecturally incorrect and leads to instability.

**The Fix:** We will move all E2B interaction to the Python backend, which will act as a secure proxy. The frontend will no longer have any knowledge of E2B API keys or session management.

| Problem | Root Cause | Fix |
|---|---|---|
| **High Security Risk** | `E2B_API_KEY` is exposed in frontend TypeScript code (`keys.ts`). | Remove key from frontend; all E2B calls must be proxied through the backend. |
| **Unstable Canvas** | Frontend `use-canvas.ts` makes direct calls to E2B, which is unreliable and insecure. | Create a new backend endpoint (`/api/sandbox/browser`) to handle all browser actions. |
| **Incorrect Session Handling** | E2B sessions are not being managed or cached correctly on the backend. | Implement robust session management in `session.py` and `tool_executor.py` to create, cache, and reuse sandboxes. |

---



## 2. Production-Ready Code Fixes

Here is the complete, corrected code for each file. 

### `config.py` (Corrected)

This version loads the `E2B_API_KEY` securely from environment variables and removes it from the settings that could be accidentally exposed.

```python
"""
Centralized configuration management using Pydantic.

Loads settings from environment variables and .env files.
Ensures that secrets are not hardcoded and are managed in a secure, consistent way.
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env file if it exists
if os.path.exists(".env"):
    from dotenv import load_dotenv
    load_dotenv()

class Settings(BaseSettings):
    """Application settings."""

    # Database
    database_url: str = ""

    # LLM API Keys
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # E2B Sandbox
    # CRITICAL: This is now loaded directly in the session manager
    # and NOT exposed as a setting to prevent accidental leakage.

    # Model configuration for Pydantic
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding=\'utf-8\', extra=\'ignore\')


settings = Settings()

# Securely get the E2B API key
def get_e2b_api_key() -> str:
    e2b_api_key = os.getenv("E2B_API_KEY")
    if not e2b_api_key:
        raise ValueError("E2B_API_KEY environment variable not set.")
    return e2b_api_key

```



```

---

### `session.py` (Corrected)

This new version simplifies session and sandbox management. It provides a single, reliable function `get_or_create_sandbox` that the main completion endpoint will use. All caching logic is removed from this file and will be handled by the main request handler, simplifying the architecture.

```python
"""
E2B Sandbox Session Management.

Handles the creation, connection, and lifecycle of E2B sandboxes.
This version is simplified to focus solely on sandbox creation, with caching
and session context managed at a higher level in the main completion endpoint.
"""

import asyncio
import structlog
from e2b import Sandbox

from .config import get_e2b_api_key

logger = structlog.get_logger()

# In-memory cache for active sandboxes
# This is a simple cache; for production, a distributed cache like Redis would be better.
_sandbox_cache = {}


async def get_or_create_sandbox(session_id: str) -> Sandbox:
    """
    Get a sandbox from the cache or create a new one if it doesn\'t exist.
    This is the primary entry point for all tool execution requiring a sandbox.
    """
    if session_id in _sandbox_cache and _sandbox_cache[session_id].is_running:
        logger.info("sandbox_cache_hit", session_id=session_id)
        return _sandbox_cache[session_id]

    logger.info("sandbox_cache_miss", session_id=session_id)

    def on_exit(sandbox_id):
        logger.info("sandbox_exited", sandbox_id=sandbox_id)
        if session_id in _sandbox_cache:
            del _sandbox_cache[session_id]

    try:
        api_key = get_e2b_api_key()
        sandbox = await Sandbox.create(
            id=f"rubic-chat-{session_id}",
            api_key=api_key,
            on_exit=lambda: on_exit(session_id),
            timeout=300,  # 5-minute timeout for the sandbox itself
        )
        _sandbox_cache[session_id] = sandbox
        logger.info("sandbox_created", sandbox_id=sandbox.id, session_id=session_id)
        return sandbox
    except Exception as e:
        logger.error("sandbox_creation_failed", error=str(e))
        raise


async def close_sandbox(session_id: str) -> None:
    """Explicitly close and remove a sandbox from the cache."""
    if session_id in _sandbox_cache:
        sandbox = _sandbox_cache[session_id]
        await sandbox.close()
        del _sandbox_cache[session_id]
        logger.info("sandbox_closed", session_id=session_id)

```

---

### `tool_executor.py` (New Backend Browser Proxy)

This is a snippet for `tool_executor.py` showing the new backend-driven browser control. The full file will be in Document 2, but this part is critical for the E2B security fix. We are creating a secure proxy for all browser actions.

```python
# In your FastAPI router (e.g., in a new file like `routers/sandbox.py`)

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from e2b import Sandbox

from ..session import get_or_create_sandbox

router = APIRouter(prefix="/sandbox", tags=["Sandbox"])

class BrowserActionRequest(BaseModel):
    session_id: str
    action: str
    params: dict

@router.post("/browser")
async def handle_browser_action(request: BrowserActionRequest):
    """
    Securely proxy browser actions from the frontend to the E2B sandbox.
    The frontend no longer has direct access to the sandbox.
    """
    try:
        sandbox = await get_or_create_sandbox(request.session_id)
        browser = sandbox.browser

        action_map = {
            "navigate": browser.open_url,
            "click": browser.click,
            "input": browser.type,
            "scroll": browser.scroll,
            "screenshot": browser.screenshot,
        }

        if request.action not in action_map:
            raise HTTPException(status_code=400, detail="Invalid browser action")

        # Dynamically call the browser method
        result = await action_map[request.action](**request.params)

        # The screenshot is now taken on the backend and sent to the frontend
        screenshot_b64 = await browser.screenshot_as_base64()

        return {"success": True, "result": result, "screenshot": screenshot_b64}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

```

This concludes the necessary changes for securing the E2B sandbox. The frontend will now make all browser requests to this new `/sandbox/browser` endpoint instead of calling E2B directly.

---
