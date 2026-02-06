"""
The core agentic tool loop — the heart of Rubic's AI engine.

Based on Anthropic's canonical agentic loop pattern:
1. Send messages + tools to Claude
2. Stream text chunks to client
3. If Claude responds with tool_use blocks, execute them
4. Feed tool results back as the next user message
5. Repeat until Claude responds with text only (no tool calls)

Max 50 iterations (Manus averages ~50 tool calls per complex task).

Cache optimization (3-point strategy from Anthropic):
- tools: cache_control on last tool definition
- system: cache_control on system prompt
- messages: cache_control on last user message
This gives >80% cache hit rate, reducing input cost by 10x.
"""

import copy
import json
import time
from typing import Any, Callable, Coroutine

import structlog
from anthropic import AsyncAnthropic

logger = structlog.get_logger()

MAX_ITERATIONS = 50

# Type aliases for callbacks
TextChunkCallback = Callable[[str], Coroutine[Any, Any, None]]
ToolStartCallback = Callable[[str, dict], Coroutine[Any, Any, None]]
ToolResultCallback = Callable[[str, Any, bool], Coroutine[Any, Any, None]]
ExecuteToolFn = Callable[[str, dict], Coroutine[Any, Any, Any]]


def prepare_tools_with_cache(tools: list[dict]) -> list[dict]:
    """
    Add cache_control to the LAST tool definition.
    This caches all tool schemas as a single prefix.

    Cache hierarchy: tools → system → messages
    Changing tools invalidates system + messages cache.
    That's why tools are assembled ONCE per session.
    """
    if not tools:
        return tools

    # Deep copy to avoid mutating the original
    cached_tools = copy.deepcopy(tools)
    cached_tools[-1]["cache_control"] = {"type": "ephemeral"}
    return cached_tools


def prepare_messages_with_cache(messages: list[dict]) -> list[dict]:
    """
    Add cache_control to the LAST message in the conversation.
    This caches the entire conversation history up to this point.

    On each turn, only the new user message + tool results are uncached.
    Everything before the breakpoint is a cache hit (10x cheaper).
    """
    if not messages:
        return messages

    # Deep copy to avoid mutating the original
    cached_messages = copy.deepcopy(messages)

    last_msg = cached_messages[-1]
    if isinstance(last_msg.get("content"), list):
        # If content is a list of blocks (tool_results), add cache to last block
        if last_msg["content"]:
            last_msg["content"][-1]["cache_control"] = {"type": "ephemeral"}
    elif isinstance(last_msg.get("content"), str):
        # If content is a string, wrap it in a block to add cache_control
        cached_messages[-1] = {
            "role": last_msg["role"],
            "content": [
                {
                    "type": "text",
                    "text": last_msg["content"],
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        }

    return cached_messages


async def agent_loop(
    client: AsyncAnthropic,
    messages: list[dict],
    system_prompt: str,
    tools: list[dict],
    model: str,
    max_tokens: int = 4096,
    execute_tool_fn: ExecuteToolFn | None = None,
    on_text_chunk: TextChunkCallback | None = None,
    on_tool_start: ToolStartCallback | None = None,
    on_tool_result: ToolResultCallback | None = None,
) -> dict:
    """
    Full agentic loop with streaming text and tool execution.

    Args:
        client: Anthropic async client
        messages: Conversation history (list of user/assistant messages)
        system_prompt: Stable system prompt (cached via cache_control)
        tools: Tool definitions in Anthropic format
        model: Model ID to use
        max_tokens: Max tokens per LLM call
        execute_tool_fn: async (name, input) -> result
        on_text_chunk: async (text) -> None, called for each streamed text chunk
        on_tool_start: async (name, input) -> None, called when tool execution begins
        on_tool_result: async (name, result, is_error) -> None, called after tool executes

    Returns:
        dict with: content, tool_calls, iterations, usage, duration_ms
    """
    all_tool_calls = []
    total_input_tokens = 0
    total_output_tokens = 0
    total_cache_read = 0
    total_cache_create = 0
    collected_text = []
    start_time = time.monotonic()

    # Prepare tools with cache breakpoint on last tool (done once, reused)
    cached_tools = prepare_tools_with_cache(tools)

    for iteration in range(MAX_ITERATIONS):
        # Reset per-iteration state
        iter_text: list[str] = []
        tool_use_blocks: list[dict] = []
        current_tool_json = ""

        # Apply cache breakpoint on last message (changes each iteration)
        cached_messages = prepare_messages_with_cache(messages)

        try:
            async with client.messages.stream(
                model=model,
                max_tokens=max_tokens,
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                tools=cached_tools,
                messages=cached_messages,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_start":
                        if event.content_block.type == "tool_use":
                            tool_use_blocks.append({
                                "type": "tool_use",
                                "id": event.content_block.id,
                                "name": event.content_block.name,
                                "input": {},
                            })
                            current_tool_json = ""

                    elif event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            iter_text.append(event.delta.text)
                            if on_text_chunk:
                                await on_text_chunk(event.delta.text)
                        elif hasattr(event.delta, "partial_json"):
                            current_tool_json += event.delta.partial_json

                    elif event.type == "content_block_stop":
                        if tool_use_blocks and current_tool_json:
                            try:
                                tool_use_blocks[-1]["input"] = json.loads(current_tool_json)
                            except json.JSONDecodeError:
                                tool_use_blocks[-1]["input"] = {"raw": current_tool_json}
                            current_tool_json = ""

                # Get usage from final message
                final_msg = await stream.get_final_message()
                total_input_tokens += final_msg.usage.input_tokens
                total_output_tokens += final_msg.usage.output_tokens
                if hasattr(final_msg.usage, "cache_read_input_tokens"):
                    total_cache_read += final_msg.usage.cache_read_input_tokens or 0
                if hasattr(final_msg.usage, "cache_creation_input_tokens"):
                    total_cache_create += final_msg.usage.cache_creation_input_tokens or 0

        except Exception as e:
            logger.error("agent_loop_llm_error", error=str(e), iteration=iteration)
            return {
                "content": "".join(collected_text) or f"An error occurred: {str(e)}",
                "tool_calls": all_tool_calls,
                "iterations": iteration + 1,
                "error": str(e),
                "usage": {
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                    "cache_read_tokens": total_cache_read,
                    "cache_create_tokens": total_cache_create,
                },
                "duration_ms": int((time.monotonic() - start_time) * 1000),
            }

        # Accumulate text across iterations
        if iter_text:
            collected_text.extend(iter_text)

        # Build assistant content for message history
        assistant_content = []
        if iter_text:
            assistant_content.append({"type": "text", "text": "".join(iter_text)})
        assistant_content.extend(tool_use_blocks)

        # No tool calls = we're done
        if not tool_use_blocks:
            duration_ms = int((time.monotonic() - start_time) * 1000)
            logger.info(
                "agent_loop_completed",
                iterations=iteration + 1,
                tool_calls=len(all_tool_calls),
                duration_ms=duration_ms,
                cache_hit_rate=_cache_hit_rate(total_cache_read, total_input_tokens),
            )
            return {
                "content": "".join(collected_text),
                "tool_calls": all_tool_calls,
                "iterations": iteration + 1,
                "usage": {
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                    "cache_read_tokens": total_cache_read,
                    "cache_create_tokens": total_cache_create,
                },
                "duration_ms": duration_ms,
                "messages": messages,
            }

        # Append assistant message to conversation
        messages.append({"role": "assistant", "content": assistant_content})

        # Execute tools — ALL results in a SINGLE user message
        # (Anthropic requirement for parallel tool use)
        tool_results = []
        for block in tool_use_blocks:
            if on_tool_start:
                await on_tool_start(block["name"], block["input"])

            try:
                if execute_tool_fn:
                    result = await execute_tool_fn(block["name"], block["input"])
                else:
                    result = {"error": "No tool executor configured"}
                is_error = False
            except Exception as e:
                logger.error("tool_execution_error", tool=block["name"], error=str(e))
                result = f"Error: {str(e)}"
                is_error = True

            all_tool_calls.append({
                "name": block["name"],
                "input": block["input"],
                "result": result,
                "is_error": is_error,
                "tool_use_id": block["id"],
            })

            # Serialize result for the tool_result content
            if isinstance(result, dict):
                content_str = json.dumps(result)
            else:
                content_str = str(result)

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block["id"],
                "content": content_str,
                "is_error": is_error,
            })

            if on_tool_result:
                await on_tool_result(block["name"], result, is_error)

        # tool_result blocks go in the next user message
        messages.append({"role": "user", "content": tool_results})

        logger.debug(
            "agent_loop_iteration",
            iteration=iteration + 1,
            tools_called=[b["name"] for b in tool_use_blocks],
        )

    # Max iterations reached
    duration_ms = int((time.monotonic() - start_time) * 1000)
    logger.warning("agent_loop_max_iterations", iterations=MAX_ITERATIONS, duration_ms=duration_ms)

    return {
        "content": "".join(collected_text) or "Task reached maximum iterations.",
        "tool_calls": all_tool_calls,
        "iterations": MAX_ITERATIONS,
        "max_iterations_reached": True,
        "usage": {
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "cache_read_tokens": total_cache_read,
            "cache_create_tokens": total_cache_create,
        },
        "duration_ms": duration_ms,
        "messages": messages,
    }


def _cache_hit_rate(cache_read: int, total_input: int) -> float:
    """Calculate cache hit rate as a percentage."""
    total = cache_read + total_input
    if total == 0:
        return 0.0
    return round((cache_read / total) * 100, 1)
