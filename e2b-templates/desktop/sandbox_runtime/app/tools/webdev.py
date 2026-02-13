"""WebDev endpoints — stubs pointing to orchestrator (Manus parity).

POST /webdev/{action}
"""

from typing import Any

from fastapi import APIRouter

from ..logger import get_logger

logger = get_logger("webdev")
router = APIRouter()


@router.post("/webdev/{action}")
async def webdev_action(action: str) -> dict[str, Any]:
    return {"ok": True, "note": f"Use orchestrator /api/webdev/{action} instead"}
