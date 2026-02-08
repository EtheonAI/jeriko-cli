import os
import hmac
import time

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import close_db, init_db
from .routes import completion, tools, health

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
    allow_headers=["Content-Type", "Authorization", "x-request-id", "x-user-id", "x-gateway-secret"],
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


@app.on_event("startup")
async def startup():
    logger.info(
        "agent_service_starting",
        environment=settings.environment,
        cors_origins=ALLOWED_ORIGINS,
        gateway_auth="enabled" if GATEWAY_SECRET else "disabled",
    )
    try:
        await init_db()
    except Exception as e:
        logger.warning("db_init_skipped", error=str(e), note="Agent will work without DB features")


@app.on_event("shutdown")
async def shutdown():
    logger.info("agent_service_stopping")
    await close_db()
