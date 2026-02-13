#!/usr/bin/env python3
"""Rubic Upgrade Service — Health check + runtime upgrade endpoint.

Matches Manus upgrade service on port 8340 (127.0.0.1 only).
"""

import os
import signal
import sys

import uvicorn
from fastapi import FastAPI

VERSION = "1.0.0"

app = FastAPI(title="Rubic Upgrade Service", version=VERSION)


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "version": VERSION, "service": "upgrade"}


@app.post("/upgrade")
async def upgrade():
    # Placeholder — would pull new runtime version and restart start_server
    return {"ok": True, "message": "Upgrade not yet implemented", "version": VERSION}


@app.get("/version")
async def version():
    return {"version": VERSION}


def main():
    port = int(os.getenv("UPGRADE_SERVICE_PORT", "8340"))

    def handle_signal(sig, frame):
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
