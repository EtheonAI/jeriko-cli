"""
Tests for src/config.py — Settings (pydantic-settings) configuration.

Covers:
- Default values for all settings fields
- Environment variable override
- Optional vs required fields
- Model name presence in billing cost tables
"""

import os
from unittest.mock import patch

import pytest


class TestSettingsDefaults:
    """Verify all default values match what the code expects."""

    def test_default_environment(self):
        """Environment defaults to 'development'."""
        from src.config import Settings

        s = Settings()
        assert s.environment == "development"

    def test_default_port(self):
        """Port defaults to 8000."""
        from src.config import Settings

        s = Settings()
        assert s.port == 8000

    def test_default_debug(self):
        """Debug defaults to False."""
        from src.config import Settings

        s = Settings()
        assert s.debug is False

    def test_default_redis_host(self):
        """Redis host defaults to localhost."""
        from src.config import Settings

        s = Settings()
        assert s.redis_host == "localhost"

    def test_default_redis_port(self):
        """Redis port defaults to 6379."""
        from src.config import Settings

        s = Settings()
        assert s.redis_port == 6379

    def test_default_database_url(self):
        """Database URL has a sensible default."""
        from src.config import Settings

        s = Settings()
        assert "postgresql" in s.database_url

    def test_default_e2b_template(self):
        """E2B template defaults to rubic-desktop."""
        from src.config import Settings

        s = Settings()
        assert s.e2b_template == "rubic-desktop"

    def test_default_e2b_warm_idle_ttl(self):
        """E2B warm idle TTL defaults to 600 seconds (10 minutes)."""
        from src.config import Settings

        s = Settings()
        assert s.e2b_warm_idle_ttl == 600

    def test_default_e2b_hibernate_reuse_ttl(self):
        """E2B hibernate reuse TTL defaults to 172800 seconds (48 hours)."""
        from src.config import Settings

        s = Settings()
        assert s.e2b_hibernate_reuse_ttl == 172800

    def test_default_e2b_hard_max_lifetime(self):
        """E2B hard max lifetime defaults to 259200 seconds (72 hours)."""
        from src.config import Settings

        s = Settings()
        assert s.e2b_hard_max_lifetime == 259200

    def test_default_e2b_cpu_count(self):
        """E2B CPU count defaults to 4."""
        from src.config import Settings

        s = Settings()
        assert s.e2b_cpu_count == 4

    def test_default_e2b_memory_mb(self):
        """E2B memory defaults to 4096 MB."""
        from src.config import Settings

        s = Settings()
        assert s.e2b_memory_mb == 4096

    def test_default_service_urls(self):
        """All service URLs have sensible localhost defaults."""
        from src.config import Settings

        s = Settings()
        assert "localhost" in s.task_service_url
        assert "localhost" in s.device_service_url
        assert "localhost" in s.file_service_url
        assert "localhost" in s.connector_service_url
        assert "localhost" in s.sandbox_service_url
        assert "localhost" in s.billing_service_url
        assert "localhost" in s.notification_service_url
        assert "localhost" in s.gateway_url
        assert "localhost" in s.knowledge_service_url


class TestSettingsOptionalFields:
    """Verify optional fields default to None."""

    def test_api_keys_optional(self):
        """LLM provider API keys are optional (None by default)."""
        from src.config import Settings

        s = Settings()
        assert s.anthropic_api_key is None
        assert s.openai_api_key is None
        assert s.google_api_key is None

    def test_e2b_api_key_optional(self):
        """E2B API key is optional (None by default)."""
        from src.config import Settings

        s = Settings()
        assert s.e2b_api_key is None

    def test_redis_password_optional(self):
        """Redis password is optional (None by default)."""
        from src.config import Settings

        s = Settings()
        assert s.redis_password is None

    def test_serper_api_key_optional(self):
        """Serper API key is optional (None by default)."""
        from src.config import Settings

        s = Settings()
        assert s.serper_api_key is None


class TestSettingsFromEnv:
    """Verify environment variable overrides work."""

    def test_env_overrides_port(self):
        """PORT env var overrides default port."""
        with patch.dict(os.environ, {"PORT": "9999"}, clear=False):
            from src.config import Settings

            s = Settings()
            assert s.port == 9999

    def test_env_overrides_environment(self):
        """ENVIRONMENT env var overrides default environment."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
            from src.config import Settings

            s = Settings()
            assert s.environment == "production"

    def test_env_overrides_anthropic_api_key(self):
        """ANTHROPIC_API_KEY env var sets the API key."""
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test-key"}, clear=False):
            from src.config import Settings

            s = Settings()
            assert s.anthropic_api_key == "sk-test-key"

    def test_env_overrides_debug(self):
        """DEBUG env var toggles debug mode."""
        with patch.dict(os.environ, {"DEBUG": "true"}, clear=False):
            from src.config import Settings

            s = Settings()
            assert s.debug is True

    def test_env_overrides_e2b_api_key(self):
        """E2B_API_KEY env var sets the E2B key."""
        with patch.dict(os.environ, {"E2B_API_KEY": "e2b_test_key"}, clear=False):
            from src.config import Settings

            s = Settings()
            assert s.e2b_api_key == "e2b_test_key"

    def test_extra_env_vars_ignored(self):
        """Unknown env vars are ignored (extra = 'ignore' in Config)."""
        with patch.dict(os.environ, {"TOTALLY_UNKNOWN_VAR": "whatever"}, clear=False):
            from src.config import Settings

            # Should not raise
            s = Settings()
            assert not hasattr(s, "totally_unknown_var")


class TestSettingsModelValidation:
    """Verify model names used in config align with billing cost tables."""

    def test_known_models_have_billing_costs(self):
        """All models in billing MODULE_CREDIT_COSTS should be valid model IDs."""
        from src.billing import MODEL_CREDIT_COSTS

        for model_name, costs in MODEL_CREDIT_COSTS.items():
            assert "claude" in model_name, f"Model {model_name} does not look like a Claude model ID"
            assert "input" in costs, f"Model {model_name} missing input cost"
            assert "output" in costs, f"Model {model_name} missing output cost"
            assert "cache_read" in costs, f"Model {model_name} missing cache_read cost"

    def test_default_model_in_completion_route(self):
        """DEFAULT_MODEL used in the completion route is a valid model ID."""
        from src.routes.completion import DEFAULT_MODEL

        assert "claude" in DEFAULT_MODEL
        assert "sonnet" in DEFAULT_MODEL

    def test_model_map_values_are_valid(self):
        """All values in MODEL_MAP should be full model IDs."""
        from src.routes.completion import MODEL_MAP

        for alias, model_id in MODEL_MAP.items():
            assert "claude-" in model_id, f"MODEL_MAP['{alias}'] = '{model_id}' is not a valid model ID"
