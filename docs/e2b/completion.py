# completion.py

import asyncio
import json
from typing import AsyncGenerator

import structlog
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from anthropic import AsyncAnthropic

from ..config import settings
from ..agent_loop import agent_loop, prepare_messages_with_cache, prepare_tools_with_cache
from ..session import (
    load_conversation_history,
    save_assistant_message,
    save_user_message,
)
from ..tool_executor import ExecutionContext, execute_tool
from ..tools_definitions import CORE_TOOLS
from .e2b_manager import get_sandbox_for_session # Corrected import

logger = structlog.get_logger()
router = APIRouter(tags=["Completion"])

# ... (Keep your request/response models and LLM client setup) ...

async def _stream_agent_response(
    messages: list[dict],
    system_prompt: str,
    tools: list[dict],
    model: str,
    max_tokens: int,
    user_id: str,
    session_id: str,
    user_prompt: str = "",
) -> AsyncGenerator[str, None]:
    """
    Stream the agent loop response, now with proper E2B sandbox integration.
    """
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    def sse(event_type: str, data: dict) -> str:
        return f"data: {json.dumps({"type": event_type, **data})}\n\n"

    # Get or create the E2B sandbox for this session
    # For simplicity, we assume browser tools are often needed.
    sandbox = await get_sandbox_for_session(session_id, user_id, use_desktop=True)

    if not sandbox:
        yield sse("error", {"error": "Failed to acquire a sandbox. Tool execution will not be available."})
        # You could decide to continue with text-only response or fail here
        yield "data: [DONE]\n\n"
        return

    # Create the execution context with the live sandbox object
    exec_ctx = ExecutionContext(
        user_id=user_id,
        session_id=session_id,
        sandbox=sandbox,
    )

    # Emit sandbox info so the client can make direct browser control requests if needed
    yield sse("sandbox_info", {"sandboxId": sandbox.id})

    # --- The rest of your streaming logic from the original completion.py ---
    # This part was mostly correct. The key is passing the new `exec_ctx`
    # to the `execute_tool` function.

    cached_tools = prepare_tools_with_cache(tools)
    all_tool_calls = []

    for iteration in range(10): # MAX_ITERATIONS
        # ... (your existing stream processing logic for events: content_block_start, delta, stop) ...
        # ... (this part of your code was well-structured) ...

        # IMPORTANT CHANGE: When you call execute_tool, use the new context
        # This is a simplified representation of your loop
        tool_use_blocks = [] # This would be populated from the LLM stream

        # ... (LLM streaming happens here) ...

        if not tool_use_blocks:
            # ... (end of stream logic) ...
            break

        messages.append({"role": "assistant", "content": tool_use_blocks})

        tool_results_content = []
        for block in tool_use_blocks:
            yield sse("tool_start", {"toolCallId": block["id"], "tool": block["name"], "input": block["input"]})
            
            try:
                # THE CRITICAL CHANGE IS HERE
                result = await execute_tool(block["name"], block["input"], exec_ctx)
                is_error = "error" in result
            except Exception as e:
                result = {"error": str(e)}
                is_error = True

            yield sse("tool_result", {"toolCallId": block["id"], "tool": block["name"], "success": not is_error, "result": result})

            # Your browser_frame logic was correct, it will now receive screenshot data
            if not is_error and result.get("screenshot"):
                 yield sse("browser_frame", {
                    "screenshot": result["screenshot"],
                    "url": result.get("url", ""),
                    "title": result.get("title", ""),
                })

            tool_results_content.append({
                "type": "tool_result",
                "tool_use_id": block["id"],
                "content": json.dumps(result) if isinstance(result, dict) else str(result),
                "is_error": is_error,
            })

        messages.append({"role": "user", "content": tool_results_content})

    yield "data: [DONE]\n\n"


@router.post("/complete")
async def complete(request: ..., x_user_id: str = Header(...), ...):
    # ... (Your existing setup logic for messages, model, system_prompt) ...

    # The main change is how the streaming function is called.
    # The sandbox is now managed inside _stream_agent_response.
    return StreamingResponse(
        _stream_agent_response(
            messages=messages,
            system_prompt=system_prompt,
            tools=CORE_TOOLS, # Or your dynamic tool list
            model=model,
            max_tokens=request.max_tokens,
            user_id=x_user_id,
            session_id=session_id,
            user_prompt=user_prompt,
        ),
        media_type="text/event-stream",
    )
