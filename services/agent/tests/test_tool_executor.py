"""
Tests for src/tool_executor.py — tool dispatch, execution, and result formatting.

Covers:
- execute_tool routing to correct handler
- Unknown tool returns error
- File operations (read, write, str_replace, find)
- Shell operations (exec, view, wait, kill)
- Code execution
- show_plan passthrough
- Tool result formatting
- Tools without sandbox return appropriate errors
- Dangerous device command detection
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.tool_executor import (
    ALWAYS_REQUIRE_APPROVAL,
    BROWSER_INTERACTIVE_TOOLS,
    ExecutionContext,
    execute_tool,
)


# ============================================================
# Tool dispatch routing
# ============================================================


class TestToolRouting:
    """Tests for execute_tool dispatch logic."""

    @pytest.mark.asyncio
    async def test_unknown_tool_returns_error(self, execution_context):
        """Unknown tool name returns an error dict."""
        result = await execute_tool("nonexistent_tool", {}, execution_context)
        assert "error" in result
        assert "Unknown tool" in result["error"]

    @pytest.mark.asyncio
    async def test_show_plan_returns_plan_data(self, execution_context):
        """show_plan tool echoes back title and todos."""
        tool_input = {
            "title": "Research Plan",
            "todos": [
                {"id": "1", "label": "Search web", "status": "pending"},
                {"id": "2", "label": "Analyze results", "status": "pending"},
            ],
        }
        result = await execute_tool("show_plan", tool_input, execution_context)
        assert result["title"] == "Research Plan"
        assert len(result["todos"]) == 2

    @pytest.mark.asyncio
    async def test_show_plan_with_defaults(self, execution_context):
        """show_plan uses defaults when title/todos not provided."""
        result = await execute_tool("show_plan", {}, execution_context)
        assert result["title"] == "Plan"
        assert result["todos"] == []


# ============================================================
# File operations
# ============================================================


class TestFileOperations:
    """Tests for file operation routing via execute_tool."""

    @pytest.mark.asyncio
    async def test_file_read(self, execution_context, mock_runtime):
        """file_read returns file content from sandbox."""
        mock_runtime.file_read.return_value = "Hello World"
        result = await execute_tool("file_read", {"file": "/home/user/test.txt"}, execution_context)
        assert result["content"] == "Hello World"
        assert result["path"] == "/home/user/test.txt"

    @pytest.mark.asyncio
    async def test_file_read_with_line_range(self, execution_context, mock_runtime):
        """file_read with start_line/end_line returns a slice."""
        mock_runtime.file_read.return_value = "line0\nline1\nline2\nline3\nline4"
        result = await execute_tool(
            "file_read",
            {"file": "/home/user/test.txt", "start_line": 1, "end_line": 3},
            execution_context,
        )
        assert result["content"] == "line1\nline2"

    @pytest.mark.asyncio
    async def test_file_write(self, execution_context, mock_runtime):
        """file_write writes content to sandbox."""
        result = await execute_tool(
            "file_write",
            {"file": "/home/user/out.txt", "content": "data"},
            execution_context,
        )
        assert result["success"] is True
        mock_runtime.file_write.assert_called_once()

    @pytest.mark.asyncio
    async def test_file_write_append_mode(self, execution_context, mock_runtime):
        """file_write with append=True prepends existing content."""
        mock_runtime.file_read.return_value = "existing "
        result = await execute_tool(
            "file_write",
            {"file": "/home/user/out.txt", "content": "appended", "append": True},
            execution_context,
        )
        assert result["success"] is True
        # The write should include existing + new content
        write_call = mock_runtime.file_write.call_args
        assert "existing " in write_call[0][1]
        assert "appended" in write_call[0][1]

    @pytest.mark.asyncio
    async def test_file_str_replace(self, execution_context, mock_runtime):
        """file_str_replace replaces a string in the file."""
        mock_runtime.file_read.return_value = "Hello World"
        result = await execute_tool(
            "file_str_replace",
            {"file": "/home/user/test.txt", "old_str": "World", "new_str": "Agent"},
            execution_context,
        )
        assert result["success"] is True
        write_call = mock_runtime.file_write.call_args
        assert "Hello Agent" in write_call[0][1]

    @pytest.mark.asyncio
    async def test_file_str_replace_not_found(self, execution_context, mock_runtime):
        """file_str_replace returns error when old_str not found."""
        mock_runtime.file_read.return_value = "Hello World"
        result = await execute_tool(
            "file_str_replace",
            {"file": "/home/user/test.txt", "old_str": "MISSING", "new_str": "new"},
            execution_context,
        )
        assert "error" in result
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_file_operations_require_sandbox(self, execution_context_no_sandbox):
        """File operations without sandbox return an error."""
        for op in ["file_read", "file_write", "file_str_replace", "file_find_in_content", "file_find_by_name"]:
            result = await execute_tool(op, {"file": "/test"}, execution_context_no_sandbox)
            assert "error" in result
            assert "sandbox" in result["error"].lower()


# ============================================================
# Shell operations
# ============================================================


class TestShellOperations:
    """Tests for shell operation routing via execute_tool."""

    @pytest.mark.asyncio
    async def test_shell_exec(self, execution_context):
        """shell_exec runs a command and returns output."""
        result = await execute_tool(
            "shell_exec",
            {"command": "echo hello", "exec_dir": "/home/user"},
            execution_context,
        )
        # Smart mock returns "command output\n" for unrecognized commands
        assert "stdout" in result
        assert result["exit_code"] == 0
        assert isinstance(result["stdout"], str)

    @pytest.mark.asyncio
    async def test_shell_view(self, execution_context, mock_runtime, mock_command_result):
        """shell_view runs a no-op and returns output."""
        result = await execute_tool("shell_view", {}, execution_context)
        assert "stdout" in result

    @pytest.mark.asyncio
    async def test_shell_wait(self, execution_context, mock_runtime, mock_command_result):
        """shell_wait sleeps for the requested duration."""
        mock_command_result.stdout = "WAIT_COMPLETE"
        result = await execute_tool("shell_wait", {"seconds": 5}, execution_context)
        assert "stdout" in result

    @pytest.mark.asyncio
    async def test_shell_wait_capped_at_300(self, execution_context, mock_runtime, mock_command_result):
        """shell_wait caps duration at 300 seconds."""
        await execute_tool("shell_wait", {"seconds": 9999}, execution_context)
        call_args = mock_runtime.command_run.call_args
        # The sleep command should use 300, not 9999
        assert "sleep 300" in call_args[0][0]

    @pytest.mark.asyncio
    async def test_shell_kill_process(self, execution_context, mock_runtime, mock_command_result):
        """shell_kill_process sends a kill command."""
        mock_command_result.stdout = "Process terminated"
        result = await execute_tool("shell_kill_process", {"id": "sess_1"}, execution_context)
        assert "stdout" in result

    @pytest.mark.asyncio
    async def test_shell_operations_require_sandbox(self, execution_context_no_sandbox):
        """Shell operations without sandbox return an error."""
        for op in ["shell_exec", "shell_view", "shell_wait", "shell_write_to_process", "shell_kill_process"]:
            result = await execute_tool(op, {"command": "ls"}, execution_context_no_sandbox)
            assert "error" in result
            assert "sandbox" in result["error"].lower()


# ============================================================
# Code execution
# ============================================================


class TestCodeExecution:
    """Tests for code_execute tool routing."""

    @pytest.mark.asyncio
    async def test_code_execute_python(self, execution_context, mock_runtime, mock_code_result):
        """code_execute runs Python code via code interpreter."""
        mock_code_result.stdout = "42"
        result = await execute_tool(
            "code_execute",
            {"code": "print(6 * 7)", "language": "python"},
            execution_context,
        )
        assert result["stdout"] == "42"
        mock_runtime.code_run.assert_called_once()

    @pytest.mark.asyncio
    async def test_code_execute_requires_sandbox(self, execution_context_no_sandbox):
        """code_execute without sandbox returns an error."""
        result = await execute_tool(
            "code_execute",
            {"code": "print('hi')", "language": "python"},
            execution_context_no_sandbox,
        )
        assert "error" in result
        assert "sandbox" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_code_execute_error_handling(self, execution_context, mock_runtime):
        """code_execute returns error when runtime raises."""
        mock_runtime.code_run.side_effect = Exception("Syntax error")
        result = await execute_tool(
            "code_execute",
            {"code": "invalid python code!", "language": "python"},
            execution_context,
        )
        assert "error" in result
        assert "Syntax error" in result["error"]


# ============================================================
# Web search
# ============================================================


class TestWebSearch:
    """Tests for web_search tool routing."""

    @pytest.mark.asyncio
    async def test_web_search_dispatches_correctly(self, execution_context):
        """web_search routes to browser_web_search function."""
        with patch("src.tool_executor.browser_web_search", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = {"results": [{"title": "Test", "url": "https://test.com"}]}
            result = await execute_tool(
                "web_search",
                {"query": "test query", "num_results": 3},
                execution_context,
            )
            mock_search.assert_called_once_with(
                execution_context.sandbox_id, "test query", 3, None
            )
            assert "results" in result


# ============================================================
# Browser interactive tools
# ============================================================


class TestBrowserInteractive:
    """Tests for browser interactive tool routing."""

    def test_all_browser_tools_in_set(self):
        """All expected interactive browser tools are in BROWSER_INTERACTIVE_TOOLS."""
        expected = {
            "browser_view", "browser_restart", "browser_click", "browser_input",
            "browser_move_mouse", "browser_press_key", "browser_select_option",
            "browser_scroll_up", "browser_scroll_down", "browser_console_exec",
            "browser_console_view", "browser_screenshot",
        }
        assert expected == BROWSER_INTERACTIVE_TOOLS

    @pytest.mark.asyncio
    async def test_browser_interactive_requires_sandbox(self, execution_context_no_sandbox):
        """Browser interactive tools without sandbox return an error."""
        result = await execute_tool("browser_click", {"x": 100, "y": 100}, execution_context_no_sandbox)
        assert "error" in result

    @pytest.mark.asyncio
    async def test_browser_interactive_requires_desktop(self, execution_context, mock_runtime):
        """Browser interactive tools require a desktop sandbox."""
        mock_runtime.is_desktop = False
        result = await execute_tool("browser_click", {"x": 100, "y": 100}, execution_context)
        assert "error" in result
        assert "Desktop" in result["error"]


# ============================================================
# Device tools
# ============================================================


class TestDeviceTools:
    """Tests for device_* tool routing."""

    @pytest.mark.asyncio
    async def test_device_tool_requires_approval_by_default(self, execution_context):
        """Device tools default to requiring approval."""
        result = await execute_tool(
            "device_abc123_command",
            {"command": "ls -la", "require_approval": True},
            execution_context,
        )
        assert result["status"] == "approval_required"

    @pytest.mark.asyncio
    async def test_dangerous_commands_always_require_approval(self, execution_context):
        """Commands matching ALWAYS_REQUIRE_APPROVAL patterns require approval."""
        for dangerous_pattern in ALWAYS_REQUIRE_APPROVAL:
            result = await execute_tool(
                "device_abc123_command",
                {"command": dangerous_pattern, "require_approval": False},
                execution_context,
            )
            assert result["status"] == "approval_required", f"'{dangerous_pattern}' should require approval"

    @pytest.mark.asyncio
    async def test_invalid_device_tool_name(self, execution_context):
        """Device tool with invalid name format returns error."""
        with patch("src.tool_executor.get_http_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json = MagicMock(return_value={"output": "ok"})
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            result = await execute_tool(
                "device_command",  # Missing device_id segment
                {"command": "ls", "require_approval": False},
                execution_context,
            )
            assert "error" in result
            assert "Invalid device tool name" in result["error"]


# ============================================================
# Composio tools
# ============================================================


class TestComposioTools:
    """Tests for app_* (Composio) tool routing."""

    @pytest.mark.asyncio
    async def test_composio_tool_dispatches(self, execution_context):
        """app_ prefixed tools route to composio_execute."""
        with patch("src.tool_executor.composio_execute", new_callable=AsyncMock) as mock_composio:
            mock_composio.return_value = {"success": True, "data": "email sent"}
            result = await execute_tool(
                "app_gmail_send_email",
                {"to": "test@test.com", "body": "Hello"},
                execution_context,
            )
            mock_composio.assert_called_once_with(
                execution_context.user_id,
                "app_gmail_send_email",
                {"to": "test@test.com", "body": "Hello"},
            )


# ============================================================
# User communication
# ============================================================


class TestUserCommunication:
    """Tests for message_notify_user and message_ask_user tools."""

    @pytest.mark.asyncio
    async def test_message_notify_user(self, execution_context):
        """message_notify_user routes to send_to_user."""
        with patch("src.tool_executor.send_to_user", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = {"sent": True}
            result = await execute_tool(
                "message_notify_user",
                {"text": "Task completed!"},
                execution_context,
            )
            mock_send.assert_called_once()
            assert result["sent"] is True

    @pytest.mark.asyncio
    async def test_message_ask_user(self, execution_context):
        """message_ask_user routes to send_to_user."""
        with patch("src.tool_executor.send_to_user", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = {"sent": True}
            result = await execute_tool(
                "message_ask_user",
                {"text": "Should I continue?"},
                execution_context,
            )
            mock_send.assert_called_once()


# ============================================================
# Deployment tools
# ============================================================


class TestDeploymentTools:
    """Tests for deploy_expose_port and deploy_apply_deployment."""

    @pytest.mark.asyncio
    async def test_expose_port(self, execution_context, mock_runtime):
        """deploy_expose_port returns a public URL."""
        mock_runtime.get_host.return_value = "sbx-123.e2b.dev"
        result = await execute_tool(
            "deploy_expose_port",
            {"port": 3000},
            execution_context,
        )
        assert "url" in result
        assert "sbx-123.e2b.dev" in result["url"]
        assert result["port"] == 3000

    @pytest.mark.asyncio
    async def test_expose_port_requires_sandbox(self, execution_context_no_sandbox):
        """deploy_expose_port without sandbox returns an error."""
        result = await execute_tool(
            "deploy_expose_port",
            {"port": 3000},
            execution_context_no_sandbox,
        )
        assert "error" in result

    @pytest.mark.asyncio
    async def test_apply_deployment_requires_sandbox(self, execution_context_no_sandbox):
        """deploy_apply_deployment without sandbox returns an error."""
        result = await execute_tool(
            "deploy_apply_deployment",
            {"type": "static"},
            execution_context_no_sandbox,
        )
        assert "error" in result


# ============================================================
# Scheduling
# ============================================================


class TestSchedulingTools:
    """Tests for schedule_recurring_task tool."""

    @pytest.mark.asyncio
    async def test_schedule_recurring_task(self, execution_context):
        """schedule_recurring_task routes to create_recurring_task."""
        with patch("src.tool_executor.create_recurring_task", new_callable=AsyncMock) as mock_task:
            mock_task.return_value = {"created": True, "task_id": "task_001"}
            result = await execute_tool(
                "schedule_recurring_task",
                {"name": "Weekly report", "schedule": "weekly"},
                execution_context,
            )
            mock_task.assert_called_once()
            assert result["created"] is True


# ============================================================
# Outcome tracking
# ============================================================


class TestOutcomeTracking:
    """Tests for check_outcomes tool."""

    @pytest.mark.asyncio
    async def test_check_outcomes(self, execution_context):
        """check_outcomes routes to execute_check_outcomes."""
        with patch("src.tool_executor.execute_check_outcomes", new_callable=AsyncMock) as mock_outcomes:
            mock_outcomes.return_value = {"message": "No analytics available", "source": "custom"}
            result = await execute_tool(
                "check_outcomes",
                {"source": "custom"},
                execution_context,
            )
            mock_outcomes.assert_called_once()
