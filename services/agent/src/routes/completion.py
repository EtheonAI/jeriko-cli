import json
from typing import AsyncGenerator

import structlog
from anthropic import AsyncAnthropic
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel

from ..config import settings

logger = structlog.get_logger()
router = APIRouter(tags=["Completion"])


class CompletionRequest(BaseModel):
    """Request for AI completion."""

    prompt: str
    model: str = "claude-3-5-sonnet"
    max_tokens: int = 4096
    temperature: float = 0.7
    system_prompt: str | None = None
    tools: list[dict] | None = None
    stream: bool = True
    target_device_id: str | None = None


class CompletionResponse(BaseModel):
    """Response from AI completion."""

    content: str
    model: str
    usage: dict
    tool_calls: list[dict] | None = None


# Initialize clients lazily
_anthropic_client: AsyncAnthropic | None = None
_openai_client: AsyncOpenAI | None = None


def get_anthropic_client() -> AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        if not settings.anthropic_api_key:
            raise HTTPException(status_code=500, detail="Anthropic API key not configured")
        _anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client


def get_openai_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        if not settings.openai_api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai_client


@router.post("/complete")
async def complete(
    request: CompletionRequest,
    x_user_id: str = Header(..., alias="x-user-id"),
    x_task_id: str | None = Header(None, alias="x-task-id"),
):
    """
    Generate AI completion.

    Supports both streaming and non-streaming modes.
    """
    logger.info(
        "completion_requested",
        user_id=x_user_id,
        task_id=x_task_id,
        model=request.model,
        stream=request.stream,
    )

    if request.stream:
        return StreamingResponse(
            stream_completion(request, x_user_id, x_task_id),
            media_type="text/event-stream",
        )

    return await non_streaming_completion(request, x_user_id, x_task_id)


async def stream_completion(
    request: CompletionRequest,
    user_id: str,
    task_id: str | None,
) -> AsyncGenerator[str, None]:
    """Stream completion using SSE format."""

    if request.model.startswith("claude"):
        async for chunk in stream_anthropic(request):
            yield f"data: {json.dumps(chunk)}\n\n"
    elif request.model.startswith("gpt"):
        async for chunk in stream_openai(request):
            yield f"data: {json.dumps(chunk)}\n\n"
    else:
        yield f"data: {json.dumps({'error': 'Unknown model'})}\n\n"

    yield "data: [DONE]\n\n"


async def stream_anthropic(request: CompletionRequest) -> AsyncGenerator[dict, None]:
    """Stream from Anthropic Claude."""
    client = get_anthropic_client()

    messages = [{"role": "user", "content": request.prompt}]

    async with client.messages.stream(
        model=request.model.replace("claude-3-5-sonnet", "claude-sonnet-4-20250514"),
        max_tokens=request.max_tokens,
        messages=messages,
        system=request.system_prompt or "You are a helpful AI assistant.",
        temperature=request.temperature,
    ) as stream:
        async for text in stream.text_stream:
            yield {"type": "content", "content": text}

        # Get final message for usage
        message = await stream.get_final_message()
        yield {
            "type": "done",
            "usage": {
                "input_tokens": message.usage.input_tokens,
                "output_tokens": message.usage.output_tokens,
            },
        }


async def stream_openai(request: CompletionRequest) -> AsyncGenerator[dict, None]:
    """Stream from OpenAI."""
    client = get_openai_client()

    messages = [
        {"role": "system", "content": request.system_prompt or "You are a helpful AI assistant."},
        {"role": "user", "content": request.prompt},
    ]

    stream = await client.chat.completions.create(
        model=request.model,
        messages=messages,
        max_tokens=request.max_tokens,
        temperature=request.temperature,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield {"type": "content", "content": chunk.choices[0].delta.content}

    yield {"type": "done", "usage": {}}


async def non_streaming_completion(
    request: CompletionRequest,
    user_id: str,
    task_id: str | None,
) -> CompletionResponse:
    """Non-streaming completion."""

    if request.model.startswith("claude"):
        return await anthropic_completion(request)
    elif request.model.startswith("gpt"):
        return await openai_completion(request)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown model: {request.model}")


async def anthropic_completion(request: CompletionRequest) -> CompletionResponse:
    """Complete using Anthropic Claude."""
    client = get_anthropic_client()

    messages = [{"role": "user", "content": request.prompt}]

    response = await client.messages.create(
        model=request.model.replace("claude-3-5-sonnet", "claude-sonnet-4-20250514"),
        max_tokens=request.max_tokens,
        messages=messages,
        system=request.system_prompt or "You are a helpful AI assistant.",
        temperature=request.temperature,
    )

    return CompletionResponse(
        content=response.content[0].text if response.content else "",
        model=response.model,
        usage={
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        },
    )


async def openai_completion(request: CompletionRequest) -> CompletionResponse:
    """Complete using OpenAI."""
    client = get_openai_client()

    messages = [
        {"role": "system", "content": request.system_prompt or "You are a helpful AI assistant."},
        {"role": "user", "content": request.prompt},
    ]

    response = await client.chat.completions.create(
        model=request.model,
        messages=messages,
        max_tokens=request.max_tokens,
        temperature=request.temperature,
    )

    choice = response.choices[0]

    return CompletionResponse(
        content=choice.message.content or "",
        model=response.model,
        usage={
            "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
            "completion_tokens": response.usage.completion_tokens if response.usage else 0,
        },
    )
