import structlog
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..config import settings

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
    """List all available tools."""
    return list(TOOLS.values())


@router.post("/tools/execute")
async def execute_tool(
    request: ToolExecutionRequest,
    x_user_id: str = Header(..., alias="x-user-id"),
    x_task_id: str | None = Header(None, alias="x-task-id"),
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
        raise HTTPException(status_code=404, detail=f"Tool not found: {request.tool_name}")

    # Check if tool requires device-related capabilities
    if tool.required_capabilities and request.target_device_id:
        # For device-related tools, forward to device service
        return await execute_device_tool(request, x_user_id, x_task_id)

    # Execute tool based on type
    try:
        if request.tool_name == "web_search":
            result = await execute_web_search(request.arguments)
        elif request.tool_name == "browse_url":
            result = await execute_browse_url(request.arguments)
        elif request.tool_name == "execute_code":
            result = await execute_code(request.arguments)
        elif request.tool_name == "create_document":
            result = await execute_create_document(request.arguments)
        elif request.tool_name == "generate_image":
            result = await execute_generate_image(request.arguments)
        else:
            return ToolExecutionResponse(
                success=False,
                error=f"Tool implementation not found: {request.tool_name}",
            )

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


async def execute_web_search(arguments: dict) -> dict:
    """Execute web search."""
    # TODO: Integrate with Serper/Tavily
    query = arguments.get("query", "")
    return {"query": query, "results": [], "message": "Search integration pending"}


async def execute_browse_url(arguments: dict) -> dict:
    """Browse URL and extract content."""
    import httpx

    url = arguments.get("url", "")

    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30.0)
        return {
            "url": url,
            "status_code": response.status_code,
            "content_type": response.headers.get("content-type"),
            "content_length": len(response.text),
            "content": response.text[:5000],  # Truncate for safety
        }


async def execute_code(arguments: dict) -> dict:
    """Execute code in E2B sandbox."""
    # TODO: Integrate E2B
    code = arguments.get("code", "")
    language = arguments.get("language", "python")
    return {
        "language": language,
        "executed": False,
        "message": "E2B integration pending",
    }


async def execute_create_document(arguments: dict) -> dict:
    """Create a document."""
    # TODO: Integrate document generation
    doc_type = arguments.get("type", "pdf")
    return {
        "type": doc_type,
        "created": False,
        "message": "Document generation pending",
    }


async def execute_generate_image(arguments: dict) -> dict:
    """Generate an image."""
    # TODO: Integrate DALL-E/Stable Diffusion
    prompt = arguments.get("prompt", "")
    return {
        "prompt": prompt,
        "generated": False,
        "message": "Image generation pending",
    }
