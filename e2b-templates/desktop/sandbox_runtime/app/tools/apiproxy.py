"""Forward apiproxy calls from inside the sandbox to the orchestrator.

data_api.py and rubic-mcp-cli call http://127.0.0.1:9330/apiproxy.v1.ApiProxyService/CallApi.
This route forwards to the orchestrator which then routes to the connector service (Composio).

Upload presign has a local S3 fallback so rubic-upload-file works even when
ORCHESTRATOR_URL is not reachable (e.g. local dev, E2B sandboxes without tunnel).
"""

import os
import json
import uuid
import httpx
from fastapi import APIRouter, Request, Response

router = APIRouter()


def _get_sandbox_token(request: Request) -> str:
    """Read sandbox API token from header or secrets file."""
    token = request.headers.get("x-sandbox-token", "")
    if not token:
        token_path = os.path.expanduser("~/.secrets/sandbox_api_token")
        try:
            with open(token_path) as f:
                token = f.read().strip()
        except FileNotFoundError:
            pass
    return token


@router.post("/apiproxy.v1.ApiProxyService/CallApi")
async def call_api(request: Request):
    """Forward API proxy calls to the orchestrator."""
    orchestrator_url = os.getenv("ORCHESTRATOR_URL", "")
    if not orchestrator_url:
        return {"error": "ORCHESTRATOR_URL not configured", "jsonData": "null"}

    body = await request.body()
    sandbox_token = _get_sandbox_token(request)

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


async def _local_presign(data: dict) -> dict:
    """Generate S3 presigned URLs locally using injected S3 credentials.

    This allows rubic-upload-file to work even when ORCHESTRATOR_URL is not set
    (e.g. local dev, or E2B sandboxes that can't reach the orchestrator).
    """
    try:
        import boto3
        from botocore.config import Config as BotoConfig
    except ImportError:
        return {"error": "boto3 not installed — cannot generate presigned URLs locally"}

    access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    region = os.getenv("AWS_REGION", "auto")
    bucket = os.getenv("S3_BUCKET", "")
    endpoint = os.getenv("S3_ENDPOINT", "")

    if not access_key or not secret_key or not bucket:
        return {"error": "S3 credentials not configured (need AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET)"}

    filename = data.get("filename", "file")
    content_type = data.get("contentType", "application/octet-stream")

    # Generate S3 key matching orchestrator pattern
    random_id = uuid.uuid4().hex[:16]
    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in filename)
    s3_key = f"uploads/sandbox/{random_id}_{safe_name}"

    client_kwargs = {
        "service_name": "s3",
        "aws_access_key_id": access_key,
        "aws_secret_access_key": secret_key,
        "region_name": region,
    }
    if endpoint:
        client_kwargs["endpoint_url"] = endpoint
        client_kwargs["config"] = BotoConfig(signature_version="s3v4")

    s3 = boto3.client(**client_kwargs)

    # Generate presigned PUT URL (1 hour expiry)
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": s3_key, "ContentType": content_type},
        ExpiresIn=3600,
    )

    # Generate presigned GET URL (24 hour expiry)
    access_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": s3_key},
        ExpiresIn=86400,
    )

    return {"uploadUrl": upload_url, "accessUrl": access_url, "s3Key": s3_key}


@router.post("/api/upload/presign")
async def upload_presign(request: Request):
    """Forward upload presign requests to the orchestrator.

    Falls back to local S3 presign if ORCHESTRATOR_URL is not set but S3 credentials are available.
    """
    body = await request.body()
    orchestrator_url = os.getenv("ORCHESTRATOR_URL", "")

    # Try orchestrator first
    if orchestrator_url:
        sandbox_token = _get_sandbox_token(request)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{orchestrator_url}/api/upload/presign",
                    content=body,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {sandbox_token}",
                    },
                )

            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type="application/json",
            )
        except Exception:
            pass  # Fall through to local presign

    # Local S3 presign fallback
    try:
        data = json.loads(body) if body else {}
    except json.JSONDecodeError:
        data = {}

    result = await _local_presign(data)
    return result
