import structlog
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..session import get_cached_session
from ..tool_executor import ExecutionContext, execute_tool as execute_tool_router
from .completion import setup_session_context

logger = structlog.get_logger()
router = APIRouter(tags=["Tools"])


class ToolDefinition(BaseModel):
    """Tool definition for AI agent."""

    name: str
    description: str
    parameters: dict
    required_capabilities: list[str] = []


class ToolExecutionRequest(BaseModel):
    """Request to execute a tool."""

    tool_name: str
    arguments: dict
    target_device_id: str | None = None


class ToolExecutionResponse(BaseModel):
    """Response from tool execution."""

    success: bool
    result: dict | None = None
    error: str | None = None
    requires_approval: bool = False
    approval_id: str | None = None


TOOL_NAME_MAP: dict[str, str] = {
    "browse_url": "browser_navigate",
    "execute_code": "code_execute",
}


# Available tools registry
TOOLS: dict[str, ToolDefinition] = {
    "web_search": ToolDefinition(
        name="web_search",
        description="Search the web for information",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "num_results": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    ),
    "browse_url": ToolDefinition(
        name="browse_url",
        description="Browse a URL and extract content",
        parameters={
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to browse"},
                "extract_type": {"type": "string", "enum": ["text", "html", "screenshot"]},
            },
            "required": ["url"],
        },
    ),
    "execute_code": ToolDefinition(
        name="execute_code",
        description="Execute code in a sandboxed environment",
        parameters={
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Code to execute"},
                "language": {"type": "string", "enum": ["python", "javascript", "typescript"]},
            },
            "required": ["code", "language"],
        },
        required_capabilities=["sandbox"],
    ),
    "terminal_command": ToolDefinition(
        name="terminal_command",
        description="Execute a terminal command on a connected device",
        parameters={
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Command to execute"},
                "device_id": {"type": "string", "description": "Target device ID"},
                "working_directory": {"type": "string", "description": "Working directory"},
            },
            "required": ["command", "device_id"],
        },
        required_capabilities=["terminal"],
    ),
    "file_read": ToolDefinition(
        name="file_read",
        description="Read a file from a connected device",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path"},
                "device_id": {"type": "string", "description": "Target device ID"},
            },
            "required": ["path", "device_id"],
        },
        required_capabilities=["filesystem"],
    ),
    "file_write": ToolDefinition(
        name="file_write",
        description="Write content to a file on a connected device",
        parameters={
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path"},
                "content": {"type": "string", "description": "Content to write"},
                "device_id": {"type": "string", "description": "Target device ID"},
            },
            "required": ["path", "content", "device_id"],
        },
        required_capabilities=["filesystem"],
    ),
    "create_document": ToolDefinition(
        name="create_document",
        description="Create a document (PDF, Word, Excel)",
        parameters={
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["pdf", "docx", "xlsx", "pptx"]},
                "content": {"type": "string", "description": "Document content"},
                "title": {"type": "string", "description": "Document title"},
            },
            "required": ["type", "content"],
        },
    ),
    "generate_image": ToolDefinition(
        name="generate_image",
        description="Generate an image using AI",
        parameters={
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "Image description"},
                "size": {"type": "string", "enum": ["256x256", "512x512", "1024x1024"]},
                "style": {"type": "string", "enum": ["natural", "vivid"]},
            },
            "required": ["prompt"],
        },
    ),
}


@router.get("/tools")
async def list_tools(
    x_user_id: str = Header(..., alias="x-user-id"),
) -> list[ToolDefinition]:
    """List all available tools, including Composio tools from connected apps."""
    native_tools = list(TOOLS.values())

    # Load Composio tools from connector service
    composio_tools = await _fetch_composio_tools(x_user_id)
    return native_tools + composio_tools


@router.post("/tools/execute")
async def execute_tool(
    request: ToolExecutionRequest,
    x_user_id: str = Header(..., alias="x-user-id"),
    x_task_id: str | None = Header(None, alias="x-task-id"),
    x_session_id: str | None = Header(None, alias="x-session-id"),
    x_sandbox_id: str | None = Header(None, alias="x-sandbox-id"),
) -> ToolExecutionResponse:
    """Execute a tool."""
    logger.info(
        "tool_execution_requested",
        user_id=x_user_id,
        task_id=x_task_id,
        tool=request.tool_name,
    )

    tool = TOOLS.get(request.tool_name)
    if not tool:
        # Try executing as a Composio tool via connector service
        return await _execute_composio_tool(request, x_user_id)

    # Check if tool requires device-related capabilities
    if tool.required_capabilities and request.target_device_id:
        # For device-related tools, forward to device service
        return await execute_device_tool(request, x_user_id, x_task_id)

    # Resolve runtime + sandbox_id from session cache or explicit header
    sandbox_id = x_sandbox_id
    runtime = None
    if x_session_id:
        cached = get_cached_session(x_session_id)
        if cached:
            sandbox_id = sandbox_id or cached.sandbox_id
            runtime = cached.runtime
        else:
            try:
                session_ctx = await setup_session_context(x_session_id, x_user_id)
                sandbox_id = sandbox_id or session_ctx.sandbox_id
                runtime = session_ctx.runtime
            except Exception as e:
                logger.warning("tool_session_setup_failed", error=str(e))

    exec_ctx = ExecutionContext(
        user_id=x_user_id,
        session_id=x_session_id or x_task_id or "tool",
        runtime=runtime,
        sandbox_id=sandbox_id,
    )

    # Execute tool via the shared tool executor
    try:
        tool_name = TOOL_NAME_MAP.get(request.tool_name, request.tool_name)
        tool_args = request.arguments or {}
        if request.tool_name == "browse_url":
            tool_args = {"url": tool_args.get("url", "")}

        result = await execute_tool_router(tool_name, tool_args, exec_ctx)

        # Normalize approval-required responses
        if isinstance(result, dict) and result.get("status") == "approval_required":
            return ToolExecutionResponse(
                success=False,
                requires_approval=True,
                error=result.get("message"),
                approval_id=result.get("approval_id"),
            )

        if isinstance(result, dict) and "error" in result:
            return ToolExecutionResponse(success=False, error=str(result.get("error")))

        return ToolExecutionResponse(success=True, result=result)

    except Exception as e:
        logger.error("tool_execution_failed", tool=request.tool_name, error=str(e))
        return ToolExecutionResponse(success=False, error=str(e))


async def execute_device_tool(
    request: ToolExecutionRequest,
    user_id: str,
    task_id: str | None,
) -> ToolExecutionResponse:
    """Forward tool execution to device service."""
    import httpx

    device_url = settings.device_service_url

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{device_url}/v1/tools/execute",
            json={
                "tool_name": request.tool_name,
                "arguments": request.arguments,
                "device_id": request.target_device_id,
            },
            headers={
                "x-user-id": user_id,
                "x-task-id": task_id or "",
            },
            timeout=30.0,
        )

        if response.status_code == 202:
            # Requires approval
            data = response.json()
            return ToolExecutionResponse(
                success=False,
                requires_approval=True,
                approval_id=data.get("approval_id"),
            )

        if response.status_code != 200:
            return ToolExecutionResponse(
                success=False,
                error=f"Device service error: {response.status_code}",
            )

    return ToolExecutionResponse(success=True, result=response.json())


async def _fetch_composio_tools(user_id: str) -> list[ToolDefinition]:
    """Fetch Composio tools from the connector service for the given user."""
    import httpx

    connector_url = settings.connector_service_url

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{connector_url}/users/{user_id}/tools",
                timeout=10.0,
            )

            if response.status_code != 200:
                logger.warning(
                    "composio_tools_fetch_failed",
                    status=response.status_code,
                    user_id=user_id,
                )
                return []

            data = response.json()
            tools = data.get("tools", [])

            return [
                ToolDefinition(
                    name=t["name"],
                    description=t.get("description", ""),
                    parameters=t.get("parameters", {}),
                    required_capabilities=["composio"],
                )
                for t in tools
            ]

    except Exception as e:
        logger.warning(
            "composio_tools_fetch_error",
            error=str(e),
            user_id=user_id,
        )
        return []


async def _execute_composio_tool(
    request: ToolExecutionRequest,
    user_id: str,
) -> ToolExecutionResponse:
    """Execute a tool via the connector service (Composio)."""
    import httpx

    connector_url = settings.connector_service_url

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{connector_url}/tools/execute",
                json={
                    "toolName": request.tool_name,
                    "arguments": request.arguments,
                },
                headers={
                    "x-user-id": user_id,
                },
                timeout=30.0,
            )

            if response.status_code != 200:
                data = response.json()
                return ToolExecutionResponse(
                    success=False,
                    error=data.get("error", f"Connector service error: {response.status_code}"),
                )

            data = response.json()
            return ToolExecutionResponse(
                success=data.get("success", True),
                result=data.get("result"),
            )

    except Exception as e:
        logger.error(
            "composio_tool_execution_failed",
            tool=request.tool_name,
            error=str(e),
        )
        return ToolExecutionResponse(
            success=False,
            error=f"Failed to execute Composio tool: {str(e)}",
        )
