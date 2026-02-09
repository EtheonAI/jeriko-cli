import asyncio
import os
import hmac
import time

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import close_db, init_db, fetchrow, execute
from .e2b_manager import cleanup_expired_sandboxes, shutdown_all_sandboxes
from .tool_executor import close_http_client
from .routes import completion, tools, health, browser_control, test_browser

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

logger = structlog.get_logger()

GATEWAY_SECRET = os.getenv("GATEWAY_SECRET", "")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
# When true, API key validation is enforced (skip in dev if no DB)
REQUIRE_API_KEY = os.getenv("REQUIRE_API_KEY", "false").lower() == "true"

# Initialize FastAPI app
app = FastAPI(
    title="Rubic Agent Service",
    description="AI Agent orchestration service for Rubic",
    version="0.0.1",
)

# CORS middleware — locked to explicit origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "x-request-id", "x-user-id", "x-session-id", "x-user-name", "x-api-key", "x-gateway-secret"],
)


# Gateway secret verification middleware
@app.middleware("http")
async def verify_gateway_secret(request: Request, call_next):
    # Skip auth for health endpoints
    if request.url.path.startswith("/health"):
        return await call_next(request)

    # Verify gateway secret if configured
    if GATEWAY_SECRET:
        provided = request.headers.get("x-gateway-secret", "")
        if not hmac.compare_digest(provided, GATEWAY_SECRET):
            return JSONResponse(
                status_code=401,
                content={
                    "data": None,
                    "meta": {"request_id": request.headers.get("x-request-id", "unknown")},
                    "error": {"code": "UNAUTHORIZED", "message": "Invalid or missing gateway secret"},
                },
            )

    return await call_next(request)


# API key validation middleware
@app.middleware("http")
async def validate_api_key(request: Request, call_next):
    # Skip for health and non-completion endpoints
    if not request.url.path.startswith("/v1/complete"):
        return await call_next(request)

    api_key = request.headers.get("x-api-key", "")

    # If no API key provided, allow in dev (REQUIRE_API_KEY=false)
    if not api_key:
        if REQUIRE_API_KEY:
            return JSONResponse(
                status_code=401,
                content={
                    "data": None,
                    "meta": {"request_id": request.headers.get("x-request-id", "unknown")},
                    "error": {"code": "UNAUTHORIZED", "message": "API key required. Create one at Settings > Integrations."},
                },
            )
        return await call_next(request)

    # Validate key against DB
    try:
        row = await fetchrow(
            "SELECT id, user_id, is_active FROM api_keys WHERE key = $1",
            api_key,
        )
        if not row:
            return JSONResponse(
                status_code=401,
                content={
                    "data": None,
                    "meta": {"request_id": request.headers.get("x-request-id", "unknown")},
                    "error": {"code": "UNAUTHORIZED", "message": "Invalid API key"},
                },
            )
        if not row["is_active"]:
            return JSONResponse(
                status_code=403,
                content={
                    "data": None,
                    "meta": {"request_id": request.headers.get("x-request-id", "unknown")},
                    "error": {"code": "FORBIDDEN", "message": "API key has been revoked"},
                },
            )

        # Update usage stats (non-blocking — fire and forget)
        try:
            await execute(
                "UPDATE api_keys SET last_used_at = NOW(), total_requests = total_requests + 1 WHERE id = $1",
                row["id"],
            )
        except Exception:
            pass  # Non-fatal

    except Exception as e:
        # DB not available — allow request in dev mode
        if REQUIRE_API_KEY:
            logger.error("api_key_validation_failed", error=str(e))
            return JSONResponse(
                status_code=500,
                content={
                    "data": None,
                    "meta": {"request_id": request.headers.get("x-request-id", "unknown")},
                    "error": {"code": "INTERNAL_ERROR", "message": "API key validation failed"},
                },
            )
        logger.warning("api_key_validation_skipped", error=str(e))

    return await call_next(request)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = request.headers.get("x-request-id", "unknown")
    user_id = request.headers.get("x-user-id", "anonymous")
    start_time = time.monotonic()

    logger.info(
        "request_started",
        request_id=request_id,
        user_id=user_id,
        method=request.method,
        path=request.url.path,
    )

    response = await call_next(request)

    duration_ms = round((time.monotonic() - start_time) * 1000, 2)

    logger.info(
        "request_completed",
        request_id=request_id,
        status_code=response.status_code,
        duration_ms=duration_ms,
    )

    # Propagate correlation ID in response
    response.headers["x-request-id"] = request_id

    return response


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("x-request-id", "unknown")
    logger.error("unhandled_exception", request_id=request_id, error=str(exc))

    return JSONResponse(
        status_code=500,
        content={
            "data": None,
            "meta": {"request_id": request_id},
            "error": {"code": "INTERNAL_ERROR", "message": "An internal error occurred"},
        },
    )


# Include routers
app.include_router(health.router)
app.include_router(completion.router, prefix="/v1")
app.include_router(tools.router, prefix="/v1")
app.include_router(browser_control.router)
app.include_router(test_browser.router)


_sandbox_cleanup_task: asyncio.Task | None = None


async def _periodic_sandbox_cleanup() -> None:
    """Background task that cleans up expired sandboxes every 60 seconds."""
    while True:
        try:
            await asyncio.sleep(60)
            cleaned = await cleanup_expired_sandboxes()
            if cleaned:
                logger.info("periodic_sandbox_cleanup", cleaned=cleaned)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("sandbox_cleanup_error", error=str(e))


@app.on_event("startup")
async def startup():
    global _sandbox_cleanup_task
    logger.info(
        "agent_service_starting",
        environment=settings.environment,
        cors_origins=ALLOWED_ORIGINS,
        gateway_auth="enabled" if GATEWAY_SECRET else "disabled",
        api_key_auth="required" if REQUIRE_API_KEY else "optional",
        e2b_configured=bool(settings.e2b_api_key),
    )
    try:
        await init_db()
    except Exception as e:
        logger.warning("db_init_skipped", error=str(e), note="Agent will work without DB features")

    # Start periodic sandbox cleanup
    _sandbox_cleanup_task = asyncio.create_task(_periodic_sandbox_cleanup())


@app.on_event("shutdown")
async def shutdown():
    global _sandbox_cleanup_task
    logger.info("agent_service_stopping")

    # Cancel periodic cleanup
    if _sandbox_cleanup_task:
        _sandbox_cleanup_task.cancel()
        try:
            await _sandbox_cleanup_task
        except asyncio.CancelledError:
            pass

    # Shutdown all active sandboxes
    await shutdown_all_sandboxes()

    await close_http_client()
    await close_db()
