"""FastAPI app with RSA auth middleware — Manus parity sandbox runtime.

External port 8330 (0.0.0.0) — orchestrator calls this (RSA-signed)
Internal port 9330 (127.0.0.1) — in-sandbox processes call this (no auth)
"""

import json
import os
import time
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .logger import get_logger
from .router import register_routes
from .helpers.rsa_auth import init_rsa, is_rsa_enabled, verify_rsa_signature
from .helpers.env_manager import set_env_vars, write_secret
from ..runtime_version import VERSION

logger = get_logger("server")

# Init-sandbox state
_initialized = False
_init_data: dict[str, Any] = {}


def create_app(internal: bool = False) -> FastAPI:
    """Create the FastAPI application.

    Args:
        internal: If True, creates the internal-only app (port 9330, no RSA auth).
    """
    title = "Rubic Sandbox Runtime (internal)" if internal else "Rubic Sandbox Runtime"
    app = FastAPI(title=title, version=VERSION)

    # CORS — allow all origins (sandbox is not publicly exposed)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # RSA auth middleware (external only)
    if not internal:
        @app.middleware("http")
        async def rsa_auth_middleware(request: Request, call_next):
            # Skip auth for health/version/internal endpoints
            skip_paths = {"/healthz", "/version", "/health"}
            if request.url.path in skip_paths:
                return await call_next(request)

            # Verify RSA signature if enabled
            if is_rsa_enabled():
                try:
                    await verify_rsa_signature(request)
                except Exception as e:
                    return JSONResponse(
                        {"error": "Unauthorized", "detail": str(e)},
                        status_code=401,
                    )

            return await call_next(request)

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = (time.time() - start) * 1000
        logger.info(
            "%s %s → %d (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration,
        )
        return response

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
