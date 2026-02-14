"""Forward apiproxy calls from inside the sandbox to the orchestrator.

data_api.py and rubic-mcp-cli call http://127.0.0.1:9330/apiproxy.v1.ApiProxyService/CallApi.
This route forwards to the orchestrator which then routes to the connector service (Composio).
"""

import os
import httpx
from fastapi import APIRouter, Request, Response

router = APIRouter()


@router.post("/apiproxy.v1.ApiProxyService/CallApi")
async def call_api(request: Request):
    """Forward API proxy calls to the orchestrator."""
    orchestrator_url = os.getenv("ORCHESTRATOR_URL", "")
    if not orchestrator_url:
        return {"error": "ORCHESTRATOR_URL not configured", "jsonData": "null"}

    body = await request.body()

    # Forward the sandbox token
    sandbox_token = request.headers.get("x-sandbox-token", "")
    if not sandbox_token:
        # Try reading from secrets file
        token_path = os.path.expanduser("~/.secrets/sandbox_api_token")
        try:
            with open(token_path) as f:
                sandbox_token = f.read().strip()
        except FileNotFoundError:
            pass

    headers = {
        "Content-Type": "application/json",
        "x-sandbox-token": sandbox_token,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{orchestrator_url}/apiproxy.v1.ApiProxyService/CallApi",
                content=body,
                headers=headers,
            )

        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type="application/json",
        )
    except Exception as e:
        return {"error": str(e), "jsonData": "null"}


@router.post("/api/upload/presign")
async def upload_presign(request: Request):
    """Forward upload presign requests to the orchestrator."""
    orchestrator_url = os.getenv("ORCHESTRATOR_URL", "")
    if not orchestrator_url:
        return {"error": "ORCHESTRATOR_URL not configured"}

    body = await request.body()
    sandbox_token = request.headers.get("x-sandbox-token", "")
    if not sandbox_token:
        token_path = os.path.expanduser("~/.secrets/sandbox_api_token")
        try:
            with open(token_path) as f:
                sandbox_token = f.read().strip()
        except FileNotFoundError:
            pass

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{orchestrator_url}/api/upload/presign",
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "x-sandbox-token": sandbox_token,
                },
            )

        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type="application/json",
        )
    except Exception as e:
        return {"error": str(e)}
