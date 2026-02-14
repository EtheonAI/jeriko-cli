"""Deploy endpoints — Manus parity.

POST /deploy/zip-and-upload — Zip directory and upload
POST /deploy/create-webdev-project
POST /deploy/switch-version
"""

import os
import subprocess
import tempfile
from typing import Any

from fastapi import APIRouter, Request

from ..logger import get_logger

logger = get_logger("deploy")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")


@router.post("/deploy/zip-and-upload")
async def deploy_zip_and_upload(request: Request) -> dict[str, Any]:
    body = await request.json()
    local_dir = body.get("local_dir", "")
    deploy_type = body.get("type", "static")
    user_id = body.get("user_id", "")
    session_id = body.get("session_id", "")

    if not local_dir:
        return {"error": "local_dir is required"}

    abs_dir = os.path.realpath(os.path.expanduser(local_dir))
    if not os.path.isdir(abs_dir):
        return {"error": f"Directory not found: {local_dir}"}

    try:
        # Create a temporary zip file
        zip_name = f"deploy_{session_id or 'unknown'}"
        zip_path = os.path.join(tempfile.gettempdir(), f"{zip_name}.zip")

        # Zip the directory
        result = subprocess.run(
            ["zip", "-r", zip_path, "."],
            cwd=abs_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            return {"error": f"Zip failed: {result.stderr}"}

        # Upload via rubic-upload-file
        upload_result = subprocess.run(
            ["rubic-upload-file", zip_path],
            capture_output=True,
            text=True,
            timeout=60,
        )

        # Clean up zip
        try:
            os.unlink(zip_path)
        except OSError:
            pass

        if upload_result.returncode == 0:
            url = upload_result.stdout.strip()
            logger.info(
                "Deployed %s (%s) → %s", abs_dir, deploy_type, url
            )
            return {
                "ok": True,
                "url": url,
                "type": deploy_type,
                "local_dir": abs_dir,
                "user_id": user_id,
                "session_id": session_id,
            }

        return {"error": f"Upload failed: {upload_result.stderr}"}
    except subprocess.TimeoutExpired:
        return {"error": "Deploy timed out"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/deploy/create-webdev-project")
async def deploy_create() -> dict[str, Any]:
    return {"ok": True, "note": "Use orchestrator /api/deploy/create-webdev-project"}


@router.post("/deploy/switch-version")
async def deploy_switch() -> dict[str, Any]:
    return {"ok": True, "note": "Use orchestrator /api/deploy/switch-version"}
