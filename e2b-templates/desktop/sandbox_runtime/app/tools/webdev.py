"""WebDev endpoints — stubs pointing to orchestrator (Manus parity).

POST /webdev/{action}
GET  /debug-logs — Returns browser debug data collected by vite-plugin-rubic-debug
"""

import json
import os
from typing import Any

from fastapi import APIRouter

from ..logger import get_logger

logger = get_logger("webdev")
router = APIRouter()

RUBIC_DEBUG_LOGS = "/tmp/rubic-debug-logs.json"


@router.get("/debug-logs")
async def get_debug_logs() -> dict[str, Any]:
    """Return browser debug data collected by vite-plugin-rubic-debug.

    The Vite plugin stores console logs, network requests, and UI events
    to /tmp/rubic-debug-logs.json. The agent reads this endpoint to inspect
    browser-side errors without opening DevTools.

    Matches Manus's GET /debug-logs terminal server endpoint.
    """
    if not os.path.exists(RUBIC_DEBUG_LOGS):
        return {
            "consoleLogs": [],
            "networkRequests": [],
            "uiEvents": [],
            "lastUpdated": None,
        }

    try:
        with open(RUBIC_DEBUG_LOGS, "r") as f:
            data = json.load(f)
        return data
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Failed to read debug logs: %s", e)
        return {
            "consoleLogs": [],
            "networkRequests": [],
            "uiEvents": [],
            "lastUpdated": None,
            "error": str(e),
        }


@router.delete("/debug-logs")
async def clear_debug_logs() -> dict[str, Any]:
    """Clear stored debug logs. Agent calls this after reading."""
    try:
        if os.path.exists(RUBIC_DEBUG_LOGS):
            os.unlink(RUBIC_DEBUG_LOGS)
        return {"ok": True}
    except OSError as e:
        return {"ok": False, "error": str(e)}


@router.post("/webdev/{action}")
async def webdev_action(action: str) -> dict[str, Any]:
    return {"ok": True, "note": f"Use orchestrator /api/webdev/{action} instead"}
