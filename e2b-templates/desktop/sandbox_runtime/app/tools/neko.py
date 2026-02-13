"""Neko/VNC pre-auth and TURN token endpoints — Manus parity.

GET  /vnc/pre-auth
GET  /neko/pre-auth
POST /refresh/turn_token
"""

import os
from typing import Any

from fastapi import APIRouter

from ..logger import get_logger

logger = get_logger("neko")
router = APIRouter()


@router.get("/vnc/pre-auth")
@router.get("/neko/pre-auth")
async def neko_pre_auth() -> dict[str, Any]:
    return {
        "ok": True,
        "neko_url": "http://localhost:8333",
        "token": os.getenv("NEKO_TOKEN"),
    }


@router.post("/refresh/turn_token")
async def refresh_turn_token() -> dict[str, Any]:
    return {
        "ok": True,
        "urls": [
            os.getenv("TURN_URL", "turn:turn.cloudflare.com:3478?transport=udp")
        ],
        "username": os.getenv("TURN_USERNAME", ""),
        "credential": os.getenv("TURN_CREDENTIAL", ""),
    }
