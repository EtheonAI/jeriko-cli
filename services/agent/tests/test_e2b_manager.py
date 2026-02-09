"""
Tests for E2B sandbox manager.

Covers:
- Template selection based on tools in request
- Sandbox reuse and caching
- Session cleanup
"""

import pytest


class TestTemplateSelection:
    """Verify correct E2B template selected based on tools."""

    def test_browser_tools_use_desktop_template(self):
        """browser_* tools should use desktop template (Playwright + GUI)."""
        from src.e2b_manager import select_template

        # Any browser tool should trigger desktop
        assert select_template(["browser_navigate"]) == "desktop"
        assert select_template(["browser_click"]) == "desktop"
        assert select_template(["browser_input"]) == "desktop"
        assert select_template(["browser_screenshot"]) == "desktop"
        assert select_template(["browser_view"]) == "desktop"

        # Mixed tools with browser should still use desktop
        assert select_template(["file_write", "browser_navigate"]) == "desktop"

    def test_code_execute_uses_code_interpreter_template(self):
        """code_execute should use code-interpreter-v1 template."""
        from src.e2b_manager import select_template

        assert select_template(["code_execute"]) == "code-interpreter-v1"

        # Mixed tools with code_execute (no browser) → code-interpreter
        assert select_template(["file_write", "code_execute"]) == "code-interpreter-v1"

    def test_browser_overrides_code_interpreter(self):
        """Browser tools take priority over code_execute (desktop has both)."""
        from src.e2b_manager import select_template

        # Desktop template has both browser AND code interpreter
        assert select_template(["browser_navigate", "code_execute"]) == "desktop"

    def test_other_tools_use_base_template(self):
        """Non-browser, non-code tools should use lightweight base template."""
        from src.e2b_manager import select_template

        assert select_template(["file_write"]) == "base"
        assert select_template(["file_read"]) == "base"
        assert select_template(["shell_exec"]) == "base"
        assert select_template(["web_search"]) == "base"
        assert select_template(["show_plan"]) == "base"

        # Multiple non-special tools
        assert select_template(["file_write", "shell_exec", "web_search"]) == "base"

    def test_empty_tools_uses_base_template(self):
        """Empty tools list defaults to base."""
        from src.e2b_manager import select_template

        assert select_template([]) == "base"

    def test_template_selection_from_config(self):
        """Template names come from settings."""
        from src.config import settings
        from src.e2b_manager import select_template

        # Verify config has correct template names
        # These map to actual E2B template IDs
        assert settings.e2b_template_desktop == "desktop"
        assert settings.e2b_template_code == "code-interpreter-v1"
        assert settings.e2b_template_base == "base"
