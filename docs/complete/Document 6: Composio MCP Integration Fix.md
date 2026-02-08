# Document 6: Composio MCP Integration Fix

This document details the correct way to integrate Composio as a Model Context Protocol (MCP) server into your Python agent backend.

## 1. Executive Summary

The current implementation attempts to load Composio tools but doesn't properly integrate them into the agent's tool collection or execution loop. The goal is to have a seamless system where the agent can use both its core tools (like `shell` and `browser`) and all connected Composio tools (like Gmail, Slack, etc.) in the same conversation.

**The Fix:** We will modify `tool_executor.py` to correctly fetch and assemble Composio tools alongside the core tools. The `execute_tool` function will be updated to differentiate between a core tool and a Composio tool, routing the execution to the appropriate handler.

| Problem | Root Cause | Fix |
|---|---|---|
| **Composio Tools Not Used** | Composio tools are fetched but not correctly added to the list of tools sent to the LLM. | Create a new `assemble_all_tools` function in `tool_executor.py` that merges `CORE_TOOLS` with the tools from `composio-langchain`. |
| **Execution Fails** | The `execute_tool` function doesn't know how to run a Composio tool. | In `execute_tool`, check if the tool name exists in the Composio toolset. If it does, use the `ComposioToolSet` to execute it. |
| **No MCP Abstraction** | The integration is a one-off for Composio, not a generic MCP implementation. | For now, we will focus on a direct Composio integration. A future improvement would be to create a generic `MCPClient` that can handle any MCP server. |

---



## 2. Production-Ready Code Fixes

This section provides the corrected Python code for integrating Composio into your agent.

### `tool_executor.py` (Composio Integration)

This is the same file from Document 2, but we are highlighting the specific parts related to Composio integration. The `assemble_all_tools` function now correctly fetches tools from Composio, and the `execute_tool` function correctly routes execution to the Composio toolset.

```python
"""
Tool Executor for the Rubic Agent, with Composio MCP Integration.
"""

import structlog
from e2b import Sandbox
from composio.client import Composio
from composio.client.collections import ComposioToolSet

from .session import get_or_create_sandbox
from .tools_definitions import get_core_tool_schemas

logger = structlog.get_logger()

# Initialize the Composio client once
_composio_client = Composio()

# ============================================================
# Tool Assembly (with Composio)
# ============================================================

async def assemble_all_tools(user_id: str) -> tuple[list[dict], ComposioToolSet]:
    """
    Assemble all available tools for a user, including core tools and Composio tools.
    """
    core_schemas = get_core_tool_schemas()
    
    # Fetch connected apps for the user from Composio
    try:
        connected_apps = await _composio_client.get_connected_apps(entity_id=user_id)
        app_ids = [app.unique_id for app in connected_apps]
        
        # Get the executable toolset and schemas from Composio
        composio_toolset = await _composio_client.get_tools(app_ids=app_ids)
        composio_schemas = composio_toolset.get_tool_schemas()
        
        logger.info("composio_tools_loaded", count=len(composio_schemas))
        
    except Exception as e:
        logger.warning("composio_failed_to_load", error=str(e))
        composio_toolset = ComposioToolSet([])
        composio_schemas = []
    
    all_schemas = core_schemas + composio_schemas
    return all_schemas, composio_toolset

# ... (Core tool implementations remain the same) ...

# ============================================================
# Main Execution Router (with Composio)
# ============================================================

class ExecutionContext:
    def __init__(self, user_id: str, session_id: str, composio_toolset: ComposioToolSet):
        self.user_id = user_id
        self.session_id = session_id
        self.composio_toolset = composio_toolset

async def execute_tool(tool_name: str, args: dict, ctx: ExecutionContext) -> any:
    """
    Execute a tool by name, routing to the correct implementation (core or Composio).
    """
    logger.info("executing_tool", tool_name=tool_name)

    # **CRITICAL:** Check for and execute Composio tool first
    if ctx.composio_toolset.has_tool(tool_name):
        logger.info("routing_to_composio", tool_name=tool_name)
        try:
            # The `execute` method of the toolset handles the call
            return await ctx.composio_toolset.execute(tool_name=tool_name, args=args)
        except Exception as e:
            logger.error("composio_tool_error", tool_name=tool_name, error=str(e))
            return {"error": f"Composio tool failed: {e}"}

    # Fallback to core tool execution
    if tool_name in CORE_TOOL_IMPLEMENTATIONS:
        logger.info("routing_to_core_tool", tool_name=tool_name)
        try:
            sandbox = await get_or_create_sandbox(ctx.session_id)
            implementation = CORE_TOOL_IMPLEMENTATIONS[tool_name]
            return await implementation(sandbox, **args)
        except Exception as e:
            logger.error("core_tool_error", tool_name=tool_name, error=str(e))
            return {"error": f"Core tool failed: {e}"}

    logger.warning("tool_not_found", tool_name=tool_name)
    return {"error": f"Tool ‘{tool_name}’ not found."}

```

This completes the Composio MCP integration. Your agent can now seamlessly use tools from any connected app via Composio, in addition to its built-in core tools, all within the same agentic loop.

---
