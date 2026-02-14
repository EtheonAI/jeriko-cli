"""Email endpoints — stubs matching Manus parity.

POST /gmail/send-or-save-draft
POST /gmail/download-attachments
POST /outlook/send-or-save-draft
POST /outlook/download-mail-attachments
"""

from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from ..logger import get_logger

logger = get_logger("email")
router = APIRouter()


@router.post("/gmail/send-or-save-draft")
async def gmail_send() -> JSONResponse:
    return JSONResponse(
        {"error": "Gmail integration not configured. Connect your account in Settings."},
        status_code=501,
    )


@router.post("/gmail/download-attachments")
async def gmail_download() -> JSONResponse:
    return JSONResponse(
        {"error": "Gmail integration not configured. Connect your account in Settings."},
        status_code=501,
    )


@router.post("/outlook/send-or-save-draft")
async def outlook_send() -> JSONResponse:
    return JSONResponse(
        {"error": "Outlook integration not configured. Connect your account in Settings."},
        status_code=501,
    )


@router.post("/outlook/download-mail-attachments")
async def outlook_download() -> JSONResponse:
    return JSONResponse(
        {"error": "Outlook integration not configured. Connect your account in Settings."},
        status_code=501,
    )
