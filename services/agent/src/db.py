"""
Database module for the agent service.

Uses asyncpg for async PostgreSQL access. Provides a connection pool
that's initialized at startup and shared across all requests.
"""

import asyncio
import re
import secrets
import ssl
import string

import asyncpg
import structlog

from .config import settings

logger = structlog.get_logger()

_pool: asyncpg.Pool | None = None


async def init_db() -> None:
    """Initialize the database connection pool. Called at app startup."""
    global _pool
    if _pool is not None:
        return

    try:
        dsn = settings.database_url
        # Strip channel_binding param (not supported by asyncpg)
        if "channel_binding" in dsn:
            dsn = re.sub(r"[&?]channel_binding=[^&]*", "", dsn)

        # Create SSL context for cloud databases (Neon, Supabase, etc.)
        ssl_ctx = None
        if "sslmode=require" in dsn or ".neon.tech" in dsn:
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            # Strip sslmode from DSN (asyncpg uses ssl param instead)
            dsn = re.sub(r"[&?]sslmode=[^&]*", "", dsn) if "sslmode" in dsn else dsn

        _pool = await asyncio.wait_for(
            asyncpg.create_pool(
                dsn=dsn,
                min_size=1,
                max_size=10,
                command_timeout=30,
                ssl=ssl_ctx,
            ),
            timeout=10,
        )
        logger.info("db_pool_initialized", dsn=_redact_dsn(settings.database_url))
    except asyncio.TimeoutError:
        logger.error("db_pool_init_timeout", note="Connection timed out after 10s")
        raise
    except Exception as e:
        logger.error("db_pool_init_failed", error=str(e))
        raise


async def close_db() -> None:
    """Close the database connection pool. Called at app shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("db_pool_closed")


def get_pool() -> asyncpg.Pool:
    """Get the connection pool. Raises if not initialized."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_db() first.")
    return _pool


async def fetch(query: str, *args) -> list[asyncpg.Record]:
    """Execute a query and return all rows."""
    pool = get_pool()
    return await pool.fetch(query, *args)


async def fetchrow(query: str, *args) -> asyncpg.Record | None:
    """Execute a query and return a single row."""
    pool = get_pool()
    return await pool.fetchrow(query, *args)


async def fetchval(query: str, *args):
    """Execute a query and return a single value."""
    pool = get_pool()
    return await pool.fetchval(query, *args)


async def execute(query: str, *args) -> str:
    """Execute a query (INSERT, UPDATE, DELETE)."""
    pool = get_pool()
    return await pool.execute(query, *args)


def generate_id(length: int = 24) -> str:
    """Generate a CUID2-compatible random ID."""
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _redact_dsn(dsn: str) -> str:
    """Redact password from DSN for logging."""
    if "@" in dsn:
        prefix = dsn.split("@")[0]
        host = dsn.split("@")[1]
        if ":" in prefix:
            parts = prefix.rsplit(":", 1)
            return f"{parts[0]}:***@{host}"
    return dsn
