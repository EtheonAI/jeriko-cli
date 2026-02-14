"""Neko/VNC pre-auth and TURN token endpoints — Manus parity.

GET  /vnc/pre-auth
GET  /neko/pre-auth
POST /refresh/turn_token
"""

import os
from typing import Any

import yaml
from fastapi import APIRouter

from ..logger import get_logger

logger = get_logger("neko")
router = APIRouter()

NEKO_CONFIG_PATH = os.getenv("NEKO_CONFIG_PATH", "/opt/.rubic/neko/config/neko.yml")

# Cache the admin password from neko config
_neko_admin_password: str | None = None


def _get_neko_admin_password() -> str | None:
    """Read admin_password from neko.yml config (cached after first read)."""
    global _neko_admin_password
    if _neko_admin_password is not None:
        return _neko_admin_password

    # First check env var
    from_env = os.getenv("NEKO_TOKEN") or os.getenv("NEKO_ADMIN_PASSWORD")
    if from_env:
        _neko_admin_password = from_env
        return _neko_admin_password

    # Read from neko.yml
    try:
        with open(NEKO_CONFIG_PATH, "r") as f:
            config = yaml.safe_load(f)
        _neko_admin_password = (
            config.get("member", {}).get("multiuser", {}).get("admin_password")
        )
        if _neko_admin_password:
            logger.info("Loaded Neko admin password from %s", NEKO_CONFIG_PATH)
        return _neko_admin_password
    except Exception as e:
        logger.warning("Could not read Neko config: %s", e)
        return None


@router.get("/vnc/pre-auth")
@router.get("/neko/pre-auth")
async def neko_pre_auth() -> dict[str, Any]:
    token = _get_neko_admin_password()
    return {
        "ok": True,
        "neko_url": "http://localhost:8333",
        "token": token,
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
