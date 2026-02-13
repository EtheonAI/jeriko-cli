"""Deploy endpoints — stubs pointing to orchestrator (Manus parity).

POST /deploy/create-webdev-project
POST /deploy/switch-version
POST /deploy/zip-and-upload
"""

from typing import Any

from fastapi import APIRouter

from ..logger import get_logger

logger = get_logger("deploy")
router = APIRouter()


@router.post("/deploy/create-webdev-project")
async def deploy_create() -> dict[str, Any]:
    return {"ok": True, "note": "Use orchestrator /api/deploy/create-webdev-project instead"}


@router.post("/deploy/switch-version")
async def deploy_switch() -> dict[str, Any]:
    return {"ok": True, "note": "Use orchestrator /api/deploy/switch-version instead"}


@router.post("/deploy/zip-and-upload")
async def deploy_zip() -> dict[str, Any]:
    return {"ok": True, "note": "Use orchestrator /api/deploy/zip-upload instead"}
