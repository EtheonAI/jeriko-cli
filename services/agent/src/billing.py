"""
Billing integration — credit deduction and execution telemetry.

Called after every agent_loop completion to:
1. Calculate credit cost from token usage + model tier
2. Deduct credits via billing service
3. Log execution telemetry for optimization
"""

import json
import time

import httpx
import structlog

from .config import settings
from .db import execute as db_execute, generate_id

logger = structlog.get_logger()

# Credit cost per 1M tokens by model tier
# These map to our subscription plan credit pricing
MODEL_CREDIT_COSTS = {
    # Haiku: cheapest
    "claude-haiku-4-5-20251001": {"input": 0.08, "output": 0.4, "cache_read": 0.008},
    # Sonnet: balanced
    "claude-sonnet-4-5-20250929": {"input": 0.3, "output": 1.5, "cache_read": 0.03},
    "claude-sonnet-4-20250514": {"input": 0.3, "output": 1.5, "cache_read": 0.03},
    # Opus: expensive
    "claude-opus-4-5-20251101": {"input": 1.5, "output": 7.5, "cache_read": 0.15},
}

# Per-tool credit costs (on top of token costs)
TOOL_CREDIT_COSTS = {
    "web_search": 0.1,  # Serper API cost
    "generate_image": 0.5,  # Gemini image gen cost
    "browser_navigate": 0.05,
    "browser_screenshot": 0.05,
    "browser_click": 0.02,
    "browser_input": 0.02,
    "browser_view": 0.02,
    "browser_scroll_up": 0.01,
    "browser_scroll_down": 0.01,
    "browser_console_exec": 0.02,
    "deploy_expose_port": 0.1,
    "deploy_apply_deployment": 0.5,
}

# Default cost for unknown models
DEFAULT_COST = {"input": 0.3, "output": 1.5, "cache_read": 0.03}


def calculate_credits(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int = 0,
    tool_calls: list[dict] | None = None,
) -> float:
    """
    Calculate total credit cost for an agent_loop execution.

    Credits are a normalized unit — 1 credit ≈ $0.01 of compute.
    """
    costs = MODEL_CREDIT_COSTS.get(model, DEFAULT_COST)

    # Token cost (per 1M tokens → per token)
    token_credits = (
        (input_tokens * costs["input"] / 1_000_000)
        + (output_tokens * costs["output"] / 1_000_000)
        + (cache_read_tokens * costs["cache_read"] / 1_000_000)
    )

    # Tool cost
    tool_credits = 0.0
    if tool_calls:
        for tc in tool_calls:
            tool_credits += TOOL_CREDIT_COSTS.get(tc["name"], 0)

    # Minimum 0.01 credits per request
    total = max(token_credits + tool_credits, 0.01)

    return round(total, 4)


async def deduct_credits(
    user_id: str,
    session_id: str,
    model: str,
    usage: dict,
    tool_calls: list[dict] | None = None,
) -> dict:
    """
    Deduct credits via the billing service.

    Returns: {"success": bool, "credits_used": float, "balance_remaining": float}
    """
    credits = calculate_credits(
        model=model,
        input_tokens=usage.get("input_tokens", 0),
        output_tokens=usage.get("output_tokens", 0),
        cache_read_tokens=usage.get("cache_read_tokens", 0),
        tool_calls=tool_calls,
    )

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.billing_service_url}/usage",
                json={
                    "userId": user_id,
                    "type": "ai_completion",
                    "credits": credits,
                    "sessionId": session_id,
                    "model": model,
                    "inputTokens": usage.get("input_tokens", 0),
                    "outputTokens": usage.get("output_tokens", 0),
                    "description": f"Agent loop: {model}",
                    "metadata": {
                        "cache_read_tokens": usage.get("cache_read_tokens", 0),
                        "cache_create_tokens": usage.get("cache_create_tokens", 0),
                        "tools_used": [tc["name"] for tc in (tool_calls or [])],
                    },
                },
                headers={"x-user-id": user_id},
                timeout=10.0,
            )

            if resp.status_code >= 400:
                logger.warning(
                    "credit_deduction_failed",
                    user_id=user_id,
                    credits=credits,
                    status=resp.status_code,
                )
                return {"success": False, "credits_used": credits, "error": resp.text}

            data = resp.json()
            logger.info(
                "credits_deducted",
                user_id=user_id,
                credits=credits,
                model=model,
            )
            return {
                "success": True,
                "credits_used": credits,
                "balance_remaining": data.get("balance", 0),
            }

    except Exception as e:
        logger.warning("credit_deduction_error", error=str(e))
        return {"success": False, "credits_used": credits, "error": str(e)}


async def check_credit_balance(user_id: str) -> float | None:
    """Check user's credit balance before starting a task."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.billing_service_url}/users/{user_id}/credits",
                timeout=5.0,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("balance", 0)
            return None
    except Exception:
        return None  # Don't block on billing check failure


# ============================================================
# Execution Telemetry
# ============================================================


async def log_telemetry(
    user_id: str,
    session_id: str,
    model: str,
    usage: dict,
    iterations: int,
    tool_calls: list[dict] | None = None,
    duration_ms: int = 0,
    credits_used: float = 0,
    success: bool = True,
    error: str | None = None,
    task_summary: str = "",
) -> None:
    """
    Log execution telemetry to the database.
    Used for cost optimization, model routing improvements, and debugging.

    Non-blocking — failures are logged but don't affect the response.
    """
    tools_used = [tc["name"] for tc in (tool_calls or [])]

    try:
        await db_execute(
            """INSERT INTO usage_records
               (id, user_id, session_id, type, credits, model,
                input_tokens, output_tokens, description, metadata)
               VALUES ($1, $2, $3, 'ai_completion', $4, $5, $6, $7, $8, $9)""",
            generate_id(),
            user_id,
            session_id,
            credits_used,
            model,
            usage.get("input_tokens", 0),
            usage.get("output_tokens", 0),
            task_summary[:200] if task_summary else f"Agent loop: {iterations} iterations",
            json.dumps({
                "iterations": iterations,
                "tools_used": tools_used,
                "cache_read_tokens": usage.get("cache_read_tokens", 0),
                "cache_create_tokens": usage.get("cache_create_tokens", 0),
                "duration_ms": duration_ms,
                "success": success,
                "error": error,
            }),
        )
    except Exception as e:
        # Non-critical — don't fail the request
        logger.warning("telemetry_log_error", error=str(e))
