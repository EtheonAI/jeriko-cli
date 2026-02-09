"""
Tests for src/billing.py — credit calculation, deduction, balance checks,
and execution telemetry.

Covers:
- calculate_credits with different models and token counts
- calculate_credits with tool call costs
- deduct_credits HTTP interaction with billing service
- check_credit_balance
- log_telemetry DB persistence
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.billing import (
    DEFAULT_COST,
    MODEL_CREDIT_COSTS,
    TOOL_CREDIT_COSTS,
    calculate_credits,
    check_credit_balance,
    deduct_credits,
    log_telemetry,
)


# ============================================================
# calculate_credits
# ============================================================


class TestCalculateCredits:
    """Tests for the calculate_credits function."""

    def test_known_model_sonnet(self):
        """Sonnet model uses its specific cost rates."""
        model = "claude-sonnet-4-5-20250929"
        credits = calculate_credits(model, input_tokens=1_000_000, output_tokens=1_000_000)
        costs = MODEL_CREDIT_COSTS[model]
        expected = costs["input"] + costs["output"]
        assert credits == round(expected, 4)

    def test_known_model_haiku(self):
        """Haiku model is cheaper than Sonnet."""
        haiku = calculate_credits(
            "claude-haiku-4-5-20251001", input_tokens=1_000_000, output_tokens=1_000_000
        )
        sonnet = calculate_credits(
            "claude-sonnet-4-5-20250929", input_tokens=1_000_000, output_tokens=1_000_000
        )
        assert haiku < sonnet

    def test_known_model_opus(self):
        """Opus model is more expensive than Sonnet."""
        opus = calculate_credits(
            "claude-opus-4-5-20251101", input_tokens=1_000_000, output_tokens=1_000_000
        )
        sonnet = calculate_credits(
            "claude-sonnet-4-5-20250929", input_tokens=1_000_000, output_tokens=1_000_000
        )
        assert opus > sonnet

    def test_unknown_model_uses_default_cost(self):
        """Unknown models fall back to DEFAULT_COST rates."""
        credits = calculate_credits(
            "unknown-model-v99", input_tokens=1_000_000, output_tokens=1_000_000
        )
        expected = DEFAULT_COST["input"] + DEFAULT_COST["output"]
        assert credits == round(expected, 4)

    def test_cache_read_tokens_included(self):
        """Cache read tokens are counted at the cache_read rate."""
        model = "claude-sonnet-4-5-20250929"
        costs = MODEL_CREDIT_COSTS[model]

        no_cache = calculate_credits(model, input_tokens=1000, output_tokens=0)
        with_cache = calculate_credits(
            model, input_tokens=1000, output_tokens=0, cache_read_tokens=500_000
        )
        # Cache read adds to the total
        assert with_cache > no_cache

    def test_zero_tokens_returns_minimum(self):
        """Zero tokens still returns the minimum credit amount (0.01)."""
        credits = calculate_credits(
            "claude-sonnet-4-5-20250929", input_tokens=0, output_tokens=0
        )
        assert credits == 0.01

    def test_minimum_credit_floor(self):
        """Very small token counts still hit the 0.01 minimum."""
        credits = calculate_credits(
            "claude-sonnet-4-5-20250929", input_tokens=1, output_tokens=1
        )
        assert credits >= 0.01

    def test_tool_calls_add_credits(self):
        """Tool calls with known costs add to the total."""
        tool_calls = [{"name": "web_search"}, {"name": "browser_navigate"}]
        without_tools = calculate_credits(
            "claude-sonnet-4-5-20250929", input_tokens=100_000, output_tokens=50_000
        )
        with_tools = calculate_credits(
            "claude-sonnet-4-5-20250929",
            input_tokens=100_000,
            output_tokens=50_000,
            tool_calls=tool_calls,
        )
        expected_tool_cost = TOOL_CREDIT_COSTS["web_search"] + TOOL_CREDIT_COSTS["browser_navigate"]
        assert with_tools == round(without_tools + expected_tool_cost, 4)

    def test_unknown_tool_adds_zero(self):
        """Tools not in TOOL_CREDIT_COSTS contribute 0 credits."""
        tool_calls = [{"name": "show_plan"}, {"name": "message_notify_user"}]
        without_tools = calculate_credits(
            "claude-sonnet-4-5-20250929", input_tokens=100_000, output_tokens=50_000
        )
        with_tools = calculate_credits(
            "claude-sonnet-4-5-20250929",
            input_tokens=100_000,
            output_tokens=50_000,
            tool_calls=tool_calls,
        )
        assert with_tools == without_tools

    def test_none_tool_calls(self):
        """None tool_calls doesn't affect the result."""
        credits = calculate_credits(
            "claude-sonnet-4-5-20250929",
            input_tokens=100_000,
            output_tokens=50_000,
            tool_calls=None,
        )
        assert credits > 0

    def test_result_is_rounded_to_4_decimals(self):
        """Credit amounts are always rounded to 4 decimal places."""
        credits = calculate_credits(
            "claude-sonnet-4-5-20250929", input_tokens=123_456, output_tokens=78_901
        )
        # Check string representation has at most 4 decimal places
        decimal_str = str(credits).split(".")[1] if "." in str(credits) else ""
        assert len(decimal_str) <= 4

    def test_deploy_tools_are_expensive(self):
        """deploy_apply_deployment is the most expensive tool."""
        deploy_cost = TOOL_CREDIT_COSTS["deploy_apply_deployment"]
        for tool_name, cost in TOOL_CREDIT_COSTS.items():
            if tool_name != "deploy_apply_deployment":
                assert deploy_cost >= cost, f"{tool_name} is more expensive than deploy_apply_deployment"


# ============================================================
# deduct_credits
# ============================================================


class TestDeductCredits:
    """Tests for deduct_credits HTTP call to billing service."""

    @pytest.mark.asyncio
    async def test_successful_deduction(self):
        """Successful deduction returns success with balance."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json = MagicMock(return_value={"balance": 99.5})

        with patch("src.billing.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            result = await deduct_credits(
                user_id="user_1",
                session_id="sess_1",
                model="claude-sonnet-4-5-20250929",
                usage={"input_tokens": 1000, "output_tokens": 500},
            )

        assert result["success"] is True
        assert result["credits_used"] > 0
        assert result["balance_remaining"] == 99.5

    @pytest.mark.asyncio
    async def test_failed_deduction_http_error(self):
        """HTTP error from billing service returns failure."""
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_response.text = "Insufficient credits"

        with patch("src.billing.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            result = await deduct_credits(
                user_id="user_1",
                session_id="sess_1",
                model="claude-sonnet-4-5-20250929",
                usage={"input_tokens": 1000, "output_tokens": 500},
            )

        assert result["success"] is False
        assert "error" in result

    @pytest.mark.asyncio
    async def test_network_error_returns_failure(self):
        """Network error returns failure with error message."""
        with patch("src.billing.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=Exception("Connection refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            result = await deduct_credits(
                user_id="user_1",
                session_id="sess_1",
                model="claude-sonnet-4-5-20250929",
                usage={"input_tokens": 1000, "output_tokens": 500},
            )

        assert result["success"] is False
        assert "Connection refused" in result["error"]

    @pytest.mark.asyncio
    async def test_includes_tool_calls_in_request(self):
        """Tool call names are included in the billing request."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json = MagicMock(return_value={"balance": 50})

        with patch("src.billing.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            tool_calls = [{"name": "web_search"}, {"name": "browser_navigate"}]
            result = await deduct_credits(
                user_id="user_1",
                session_id="sess_1",
                model="claude-sonnet-4-5-20250929",
                usage={"input_tokens": 1000, "output_tokens": 500},
                tool_calls=tool_calls,
            )

        # Verify the POST body included the tool names
        call_args = mock_client.post.call_args
        posted_json = call_args.kwargs["json"]
        assert "web_search" in posted_json["metadata"]["tools_used"]
        assert "browser_navigate" in posted_json["metadata"]["tools_used"]


# ============================================================
# check_credit_balance
# ============================================================


class TestCheckCreditBalance:
    """Tests for check_credit_balance."""

    @pytest.mark.asyncio
    async def test_returns_balance(self):
        """Successful check returns the user's credit balance."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json = MagicMock(return_value={"balance": 42.5})

        with patch("src.billing.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            balance = await check_credit_balance("user_1")

        assert balance == 42.5

    @pytest.mark.asyncio
    async def test_non_200_returns_none(self):
        """Non-200 response returns None (don't block on billing errors)."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        with patch("src.billing.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            balance = await check_credit_balance("user_1")

        assert balance is None

    @pytest.mark.asyncio
    async def test_network_error_returns_none(self):
        """Network error returns None (graceful degradation)."""
        with patch("src.billing.httpx.AsyncClient") as MockClient:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=Exception("timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_client

            balance = await check_credit_balance("user_1")

        assert balance is None


# ============================================================
# log_telemetry
# ============================================================


class TestLogTelemetry:
    """Tests for log_telemetry DB persistence."""

    @pytest.mark.asyncio
    async def test_logs_to_database(self):
        """log_telemetry inserts a record into usage_records table."""
        with (
            patch("src.billing.db_execute", new_callable=AsyncMock) as mock_execute,
            patch("src.billing.generate_id", return_value="telemetry_id_001"),
        ):
            await log_telemetry(
                user_id="user_1",
                session_id="sess_1",
                model="claude-sonnet-4-5-20250929",
                usage={"input_tokens": 100, "output_tokens": 50},
                iterations=3,
                tool_calls=[{"name": "web_search"}, {"name": "file_read"}],
                duration_ms=5000,
                credits_used=0.15,
                success=True,
                task_summary="Search for latest news",
            )

        mock_execute.assert_called_once()
        call_args = mock_execute.call_args
        assert "INSERT INTO usage_records" in call_args[0][0]
        assert call_args[0][1] == "telemetry_id_001"
        assert call_args[0][2] == "user_1"
        assert call_args[0][3] == "sess_1"

        metadata = json.loads(call_args[0][9])
        assert metadata["iterations"] == 3
        assert "web_search" in metadata["tools_used"]
        assert metadata["duration_ms"] == 5000
        assert metadata["success"] is True

    @pytest.mark.asyncio
    async def test_truncates_long_task_summary(self):
        """log_telemetry truncates task_summary to 200 chars."""
        long_summary = "x" * 300

        with (
            patch("src.billing.db_execute", new_callable=AsyncMock) as mock_execute,
            patch("src.billing.generate_id", return_value="id"),
        ):
            await log_telemetry(
                user_id="u",
                session_id="s",
                model="m",
                usage={},
                iterations=1,
                task_summary=long_summary,
            )

        call_args = mock_execute.call_args
        description = call_args[0][8]
        assert len(description) == 200

    @pytest.mark.asyncio
    async def test_db_error_does_not_raise(self):
        """log_telemetry does not raise on DB error (non-critical)."""
        with (
            patch("src.billing.db_execute", new_callable=AsyncMock, side_effect=Exception("DB down")),
            patch("src.billing.generate_id", return_value="id"),
        ):
            # Should not raise
            await log_telemetry(
                user_id="u",
                session_id="s",
                model="m",
                usage={},
                iterations=1,
            )

    @pytest.mark.asyncio
    async def test_default_description_uses_iterations(self):
        """When no task_summary, description includes iteration count."""
        with (
            patch("src.billing.db_execute", new_callable=AsyncMock) as mock_execute,
            patch("src.billing.generate_id", return_value="id"),
        ):
            await log_telemetry(
                user_id="u",
                session_id="s",
                model="m",
                usage={},
                iterations=5,
                task_summary="",
            )

        call_args = mock_execute.call_args
        description = call_args[0][8]
        assert "5 iterations" in description

    @pytest.mark.asyncio
    async def test_logs_error_info(self):
        """log_telemetry includes error info in metadata on failure."""
        with (
            patch("src.billing.db_execute", new_callable=AsyncMock) as mock_execute,
            patch("src.billing.generate_id", return_value="id"),
        ):
            await log_telemetry(
                user_id="u",
                session_id="s",
                model="m",
                usage={},
                iterations=1,
                success=False,
                error="LLM rate limit exceeded",
            )

        call_args = mock_execute.call_args
        metadata = json.loads(call_args[0][9])
        assert metadata["success"] is False
        assert metadata["error"] == "LLM rate limit exceeded"
