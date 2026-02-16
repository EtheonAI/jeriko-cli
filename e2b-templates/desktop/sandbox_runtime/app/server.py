"""FastAPI app with RSA auth — Manus parity sandbox runtime.

External port 8330 (0.0.0.0) — orchestrator calls this (RSA-signed)
Internal port 9330 (127.0.0.1) — in-sandbox processes call this (no auth)

Auth: Uses FastAPI Depends() for RSA signature verification (Manus pattern).
Starlette caches request.body() in _body after first read, so the dependency
reads and verifies the body, and the route handler can re-read it for free.
"""

import os
import time
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .logger import get_logger
from .router import register_routes
from .helpers.rsa_auth import init_rsa, is_rsa_enabled, verify_body_signature
from .helpers.env_manager import set_env_vars, write_secret
from ..runtime_version import VERSION

logger = get_logger("server")

# Init-sandbox state
_initialized = False
_init_data: dict[str, Any] = {}

# Paths that skip RSA auth (health/version/docs + user-facing pre-auth endpoints)
# Manus pattern: /code-server/auth and /cs/* are "frontend direct-sends, no [RSA] auth"
# They use token-based auth (pre_auth_token) + cookie injection instead.
_SKIP_AUTH_PATHS = {"/healthz", "/version", "/health", "/docs", "/openapi.json", "/neko/pre-auth", "/vnc/pre-auth", "/code-server/auth"}

# Path prefixes that skip RSA auth (browser iframe loads /cs/* directly)
_SKIP_AUTH_PREFIXES = ("/cs/",)


async def rsa_auth_dependency(request: Request) -> None:
    """FastAPI dependency — verifies RSA signature on every request.

    Manus pattern: X-Sandbox-Api-Signature-V2 header contains base64(RSA-sign(body)).
    Starlette caches request.body() in request._body after the first call,
    so downstream handlers can call request.json() / request.body() without issue.
    """
    path = request.url.path
    if path in _SKIP_AUTH_PATHS:
        return
    if any(path.startswith(p) for p in _SKIP_AUTH_PREFIXES):
        return
    if not is_rsa_enabled():
        return

    sig_header = request.headers.get("X-Sandbox-Api-Signature-V2")
    if not sig_header:
        raise HTTPException(status_code=401, detail="Missing signature header")

    body = await request.body()  # Starlette caches this in request._body

    try:
        verify_body_signature(sig_header, body)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid signature")


class LoggingMiddleware:
    """Pure ASGI middleware for request logging.

    Wraps send to capture the HTTP response status code.
    Does NOT touch receive/body — safe to use with any other middleware.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.time()
        status_code = 0

        async def logging_send(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 0)
            await send(message)

        try:
            await self.app(scope, receive, logging_send)
        except Exception:
            status_code = 500
            raise
        finally:
            duration = (time.time() - start) * 1000
            method = scope.get("method", "?")
            path = scope.get("path", "?")
            logger.info("%s %s → %d (%.1fms)", method, path, status_code, duration)


def create_app(internal: bool = False) -> FastAPI:
    """Create the FastAPI application.

    Args:
        internal: If True, creates the internal-only app (port 9330, no RSA auth).
    """
    title = "Rubic Sandbox Runtime (internal)" if internal else "Rubic Sandbox Runtime"

    # External app: RSA auth dependency on every route (Manus pattern)
    # Internal app: no auth
    deps = [Depends(rsa_auth_dependency)] if not internal else []

    app = FastAPI(title=title, version=VERSION, dependencies=deps)

    # CORS — allow all origins (sandbox is not publicly exposed)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request logging — pure ASGI, does not touch body
    app.add_middleware(LoggingMiddleware)

    # ── Core endpoints ─────────────────────────────────────────────

    @app.get("/healthz")
    @app.get("/health")
    async def healthz():
        return {
            "status": "ok",
            "version": VERSION,
            "initialized": _initialized,
            "rsa_enabled": is_rsa_enabled(),
        }

    @app.get("/version")
    async def version():
        return {"version": VERSION}

    @app.post("/init-sandbox")
    async def init_sandbox(request: Request):
        global _initialized, _init_data
        body = await request.json()

        session_id = body.get("session_id")
        user_id = body.get("user_id")
        sandbox_token = body.get("sandbox_token")
        env_vars = body.get("env_vars", {})

        # Store init data
        _init_data = {
            "session_id": session_id,
            "user_id": user_id,
            "initialized_at": time.time(),
        }

        # Write sandbox token
        if sandbox_token:
            write_secret("sandbox_api_token", sandbox_token)

        # Set environment variables
        if env_vars:
            set_env_vars(env_vars)

        _initialized = True
        logger.info(
            "Sandbox initialized: session=%s user=%s",
            session_id, user_id,
        )
        return {"ok": True, "session_id": session_id}

    # Register all tool routes
    register_routes(app)

    return app
