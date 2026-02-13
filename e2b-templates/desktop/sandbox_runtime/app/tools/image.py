"""Image operation endpoints — Manus parity.

POST /image/rmbg — Remove background
POST /search_image/upload — Upload image for search
"""

import os
import subprocess
from typing import Any

from fastapi import APIRouter, Request

from ..logger import get_logger

logger = get_logger("image")
router = APIRouter()


@router.post("/image/rmbg")
async def image_rmbg(request: Request) -> dict[str, Any]:
    body = await request.json()
    input_path = body.get("input") or body.get("imagePath")
    if not input_path:
        return {"error": "input path required"}
    import re
    output_path = body.get("output") or re.sub(
        r"(\.\w+)$", r"_nobg\1", input_path
    )
    try:
        subprocess.run(
            ["python3", "-m", "rembg", "i", input_path, output_path],
            timeout=60, check=True,
        )
        return {"ok": True, "output": output_path}
    except FileNotFoundError:
        return {"ok": False, "error": "rembg not installed. Run: pip install rembg"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/search_image/upload")
async def search_image_upload(request: Request) -> dict[str, Any]:
    body = await request.json()
    file_path = body.get("file_path") or body.get("imagePath")
    if not file_path:
        return {"error": "file_path required"}
    try:
        result = subprocess.run(
            ["rubic-upload-file", file_path],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            return {"ok": True, "url": result.stdout.strip()}
        return {"ok": False, "error": result.stderr.strip()}
    except Exception as e:
        return {"ok": False, "error": str(e)}
