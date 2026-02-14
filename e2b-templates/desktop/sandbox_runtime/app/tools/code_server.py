"""Code-server auth + reverse proxy — Manus 3-layer security pattern.

GET  /code-server/pre-auth
POST /code-server/auth
/cs/* — reverse proxy to code-server on port 8329
"""

import asyncio
import os
import time
import httpx
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, Response

from ..logger import get_logger

logger = get_logger("code_server")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")
CS_PORT = 8329
TRIGGER_FILE = "/tmp/start_code_server"
CS_CONFIG_PATH = os.path.join(HOME, ".config", "code-server", "config.yaml")

# Pre-auth token storage
_cs_tokens: dict[str, dict[str, Any]] = {}
_cs_auth_cookie: str | None = None


def _get_cs_password() -> str:
    """Get code-server password from env var or config file."""
    from_env = os.getenv("CODE_SERVER_PASSWORD")
    if from_env:
        return from_env
    # Read from config.yaml
    try:
        with open(CS_CONFIG_PATH, "r") as f:
            for line in f:
                if line.startswith("password:"):
                    return line.split(":", 1)[1].strip()
    except Exception:
        pass
    return "rubic-default"


async def _login_to_code_server() -> None:
    """Log into code-server and cache the auth cookie."""
    global _cs_auth_cookie
    password = _get_cs_password()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"http://127.0.0.1:{CS_PORT}/login",
                data={"password": password},
                follow_redirects=False,
                timeout=5.0,
            )
            cookies = resp.headers.get_list("set-cookie")
            for cookie in cookies:
                if "key=" in cookie:
                    _cs_auth_cookie = cookie.split(";")[0]
                    logger.info("Code-server auth cookie acquired")
                    return
    except Exception as e:
        logger.debug("Code-server login attempt: %s", e)


@router.get("/code-server/pre-auth")
async def cs_pre_auth() -> dict[str, Any]:
    # Trigger code-server start
    try:
        with open(TRIGGER_FILE, "w") as f:
            f.write("1")
    except Exception:
        pass

    # Generate pre-auth token
    import secrets
    token = f"cs_{int(time.time())}_{secrets.token_hex(4)}"
    password = _get_cs_password()
    _cs_tokens[token] = {"password": password, "createdAt": time.time()}

    # Cleanup expired tokens
    now = time.time()
    expired = [k for k, v in _cs_tokens.items() if now - v["createdAt"] > 60]
    for k in expired:
        del _cs_tokens[k]

    # Wait for code-server to be ready
    ready = False
    for _ in range(30):
        try:
            await _login_to_code_server()
            if _cs_auth_cookie:
                ready = True
                break
        except Exception:
            pass
        await asyncio.sleep(0.5)

    return {
        "ok": True,
        "pre_auth_token": token,
        "proxy_path": "/cs/",
        "ready": ready,
    }


@router.post("/code-server/auth")
async def cs_auth(request: Request) -> dict[str, Any]:
    body = await request.json()
    token = body.get("pre_auth_token", "")

    if not token or token not in _cs_tokens:
        return Response(
            content='{"error":"Invalid or expired pre-auth token"}',
            status_code=401,
            media_type="application/json",
        )

    token_data = _cs_tokens[token]
    if time.time() - token_data["createdAt"] > 60:
        del _cs_tokens[token]
        return Response(
            content='{"error":"Pre-auth token expired"}',
            status_code=401,
            media_type="application/json",
        )

    del _cs_tokens[token]  # Single-use
    return {
        "ok": True,
        "password": token_data["password"],
        "proxy_path": "/cs/",
    }


@router.api_route("/cs/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def cs_proxy(request: Request, path: str = "") -> Response:
    """Reverse proxy to code-server with auth cookie injection."""
    global _cs_auth_cookie

    if not _cs_auth_cookie:
        await _login_to_code_server()
    if not _cs_auth_cookie:
        await asyncio.sleep(2)
        await _login_to_code_server()
    if not _cs_auth_cookie:
        return Response(
            content='{"error":"Code-server not running. Trigger via /code-server/pre-auth first."}',
            status_code=503,
            media_type="application/json",
        )

    target_url = f"http://127.0.0.1:{CS_PORT}/{path}"
    if request.url.query:
        target_url += f"?{request.url.query}"

    # Build headers with auth cookie
    headers = dict(request.headers)
    headers.pop("host", None)
    cookie = headers.get("cookie", "")
    if _cs_auth_cookie and "key=" not in cookie:
        cookie = f"{cookie}; {_cs_auth_cookie}" if cookie else _cs_auth_cookie
    headers["cookie"] = cookie

    try:
        body = await request.body()
        async with httpx.AsyncClient() as client:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                timeout=30.0,
                follow_redirects=False,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )
    except Exception as e:
        return Response(
            content=f'{{"error":"{str(e)}"}}',
            status_code=502,
            media_type="application/json",
        )
