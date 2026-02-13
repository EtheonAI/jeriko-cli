#!/usr/bin/env python3
"""Rubic Sandbox Runtime — Entry Point.

Starts two FastAPI servers:
  - External on 0.0.0.0:8330 (RSA-signed requests from orchestrator)
  - Internal on 127.0.0.1:9330 (localhost-only for in-sandbox processes)
"""

import asyncio
import os
import signal
import sys

import uvicorn

from sandbox_runtime.app.server import create_app
from sandbox_runtime.app.helpers.rsa_auth import init_rsa
from sandbox_runtime.app.logger import get_logger
from sandbox_runtime.runtime_version import VERSION

logger = get_logger("main")

EXTERNAL_PORT = int(os.getenv("SANDBOX_SERVER_PORT", "8330"))
INTERNAL_PORT = int(os.getenv("SANDBOX_INTERNAL_PORT", "9330"))


async def run_servers():
    """Run both external and internal servers concurrently."""

    # Initialize RSA auth
    init_rsa()

    # Create apps
    external_app = create_app(internal=False)
    internal_app = create_app(internal=True)

    # Configure uvicorn
    external_config = uvicorn.Config(
        external_app,
        host="0.0.0.0",
        port=EXTERNAL_PORT,
        log_level="warning",
        access_log=False,
    )
    internal_config = uvicorn.Config(
        internal_app,
        host="127.0.0.1",
        port=INTERNAL_PORT,
        log_level="warning",
        access_log=False,
    )

    external_server = uvicorn.Server(external_config)
    internal_server = uvicorn.Server(internal_config)

    logger.info(
        "Rubic Sandbox Runtime v%s starting — external:%d internal:%d",
        VERSION, EXTERNAL_PORT, INTERNAL_PORT,
    )

    # Run both
    await asyncio.gather(
        external_server.serve(),
        internal_server.serve(),
    )


def main():
    logger.info("Rubic Sandbox Runtime v%s — PID: %d", VERSION, os.getpid())

    # Graceful shutdown
    def handle_signal(sig, frame):
        logger.info("Received signal %s, shutting down...", sig)
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    asyncio.run(run_servers())


if __name__ == "__main__":
    main()
