"""Config endpoints — Manus parity.

POST /config/set-env
GET  /config/github-auth-status
"""

import os
import subprocess
from typing import Any

from fastapi import APIRouter, Request

from ..helpers.env_manager import set_env_vars, write_secret
from ..logger import get_logger

logger = get_logger("config")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")


@router.post("/config/set-env")
async def config_set_env(request: Request) -> dict[str, Any]:
    body = await request.json()
    updated_keys: list[str] = []

    # Handle legacy format: { env: { KEY: VALUE } }
    if "env" in body and isinstance(body["env"], dict):
        keys = set_env_vars(body["env"])
        updated_keys.extend(keys)
    elif "env_vars" in body and isinstance(body["env_vars"], dict):
        keys = set_env_vars(body["env_vars"])
        updated_keys.extend(keys)
    elif "secrets" not in body and "enabledBuiltInMCP" not in body:
        # Bare object fallback — only process string values as env vars
        bare = {
            k: v for k, v in body.items()
            if k not in ("env", "env_vars", "secrets", "enabledBuiltInMCP")
            and isinstance(v, str)
        }
        if bare:
            keys = set_env_vars(bare)
            updated_keys.extend(keys)

    # Handle Manus format: { secrets: [{ name, value }] }
    if "secrets" in body and isinstance(body["secrets"], list):
        for secret in body["secrets"]:
            name = secret.get("name")
            value = secret.get("value")
            if name and value is not None:
                write_secret(name, str(value))
                set_env_vars({name: str(value)})
                updated_keys.append(name)

    # Handle enabledBuiltInMCP
    if "enabledBuiltInMCP" in body and isinstance(body["enabledBuiltInMCP"], list):
        mcp_value = ",".join(body["enabledBuiltInMCP"])
        set_env_vars({"ENABLED_MCP_SERVERS": mcp_value})
        updated_keys.append("ENABLED_MCP_SERVERS")

    return {"ok": True, "updated": updated_keys}


@router.get("/config/github-auth-status")
async def github_auth_status() -> dict[str, Any]:
    authenticated = False
    username = None
    try:
        result = subprocess.run(
            ["gh", "auth", "status"],
            capture_output=True, text=True, timeout=5,
        )
        output = result.stdout + result.stderr
        authenticated = "Logged in" in output
        import re
        match = re.search(r"Logged in to .+ as (.+?) ", output)
        if match:
            username = match.group(1)
    except Exception:
        pass
    return {"authenticated": authenticated, "username": username}
