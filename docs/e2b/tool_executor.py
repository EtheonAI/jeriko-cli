# tool_executor.py

import asyncio
import json
from dataclasses import dataclass
import structlog
from e2b_code_interpreter import Sandbox
from e2b_desktop import Sandbox as DesktopSandbox

logger = structlog.get_logger()

@dataclass
class ExecutionContext:
    """Context passed to every tool execution, now with a live sandbox object."""
    user_id: str
    session_id: str
    sandbox: Sandbox | DesktopSandbox | None = None

async def execute_tool(name: str, tool_input: dict, ctx: ExecutionContext) -> dict:
    """
    Route tool execution to the appropriate handler using the direct E2B SDK.
    """
    logger.info("tool_execute", tool=name, user_id=ctx.user_id, session_id=ctx.session_id)

    if not ctx.sandbox:
        return {"error": "Sandbox not available for this session. Cannot execute tool."}

    try:
        # --- File Operations ---
        if name == "file_write":
            await ctx.sandbox.files.write(tool_input["path"], tool_input["content"])
            return {"success": True, "path": tool_input["path"]}

        if name == "file_read":
            content = await ctx.sandbox.files.read(tool_input["path"])
            return {"content": content}

        # --- Shell/Terminal Operations ---
        if name == "shell_exec":
            exec_result = await ctx.sandbox.commands.run(
                tool_input["command"],
                cwd=tool_input.get("exec_dir", "/home/user")
            )
            return {
                "stdout": exec_result.stdout,
                "stderr": exec_result.stderr,
                "exit_code": exec_result.exit_code
            }

        # --- Browser Operations (requires DesktopSandbox) ---
        if name.startswith("browser_"):
            if not isinstance(ctx.sandbox, DesktopSandbox):
                return {"error": "A Desktop Sandbox is required for browser tools."}
            
            desktop = ctx.sandbox
            action = name.replace("browser_", "")

            if action == "navigate":
                await desktop.open(tool_input["url"])
                await asyncio.sleep(3) # Simple wait for page load
            elif action == "click":
                await desktop.mouse.click(x=tool_input["coordinate_x"], y=tool_input["coordinate_y"])
                await asyncio.sleep(1)
            elif action == "input":
                # Note: E2B Desktop doesn't have a direct "input to element" function.
                # You first click the element, then type.
                await desktop.mouse.click(x=tool_input["coordinate_x"], y=tool_input["coordinate_y"])
                await desktop.keyboard.write(tool_input["text"])
                if tool_input.get("press_enter"): await desktop.keyboard.press("Enter")
                await asyncio.sleep(1)
            elif action == "screenshot" or action == "view":
                pass # Screenshot is taken after every action anyway
            else:
                return {"error": f"Unsupported browser action: {action}"}

            # After every browser action, take a screenshot and return it
            screenshot_b64 = await desktop.screenshot_base64()
            # url = await desktop.get_url() # Helper you would need to write with JS
            # title = await desktop.get_title() # Helper you would need to write with JS
            return {
                "screenshot": screenshot_b64,
                "url": "", # url,
                "title": "", # title
            }

        # --- Other tools can be added here ---

    except Exception as e:
        logger.error("tool_execution_error", tool=name, error=str(e))
        return {"error": f"An exception occurred during tool execution: {str(e)}"}

    return {"error": f"Unknown or unhandled tool: {name}"}
