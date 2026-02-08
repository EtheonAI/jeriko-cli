"""
Tool definitions in Anthropic's format for the agent loop.

Aligned with Manus tool surface — full browser automation, persistent shell
sessions, file search, deployment. Plus Rubic extras: image gen, Composio,
devices, scheduling, outcome tracking.

Core tools (~30) are always available. Dynamic tools (Composio, devices)
are loaded once per session and cached to preserve KV-cache.
"""

# === Core Tools (Always Available) ===

CORE_TOOLS = [
    # ─────────────────────────────────────────────────────────
    # Planning
    # ─────────────────────────────────────────────────────────
    {
        "name": "show_plan",
        "description": (
            "Create or update a plan to display progress to the user. "
            "Call this at the start of multi-step tasks to show the plan, "
            "then call it again to update step statuses as you progress. "
            "Each call replaces the previous plan display."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Short title for the plan",
                },
                "todos": {
                    "type": "array",
                    "description": "List of plan steps",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "string",
                                "description": "Unique identifier for this step",
                            },
                            "label": {
                                "type": "string",
                                "description": "Human-readable step title",
                            },
                            "status": {
                                "type": "string",
                                "enum": ["pending", "in_progress", "completed", "cancelled"],
                                "description": "Current status of this step",
                            },
                        },
                        "required": ["id", "label", "status"],
                    },
                },
            },
            "required": ["title", "todos"],
        },
    },
    # ─────────────────────────────────────────────────────────
    # Communication
    # ─────────────────────────────────────────────────────────
    {
        "name": "message_notify_user",
        "description": (
            "Send a message to user without requiring a response. Use for "
            "acknowledging receipt of messages, providing progress updates, "
            "reporting task completion, or explaining changes in approach."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Message text to display to user"},
                "attachments": {
                    "anyOf": [
                        {"type": "string"},
                        {"items": {"type": "string"}, "type": "array"},
                    ],
                    "description": "(Optional) List of attachments to show to user, can be file paths or URLs",
                },
            },
            "required": ["text"],
        },
    },
    {
        "name": "message_ask_user",
        "description": (
            "Ask user a question and wait for response. Use for requesting "
            "clarification, asking for confirmation, or gathering additional information."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "Question text to present to user"},
                "attachments": {
                    "anyOf": [
                        {"type": "string"},
                        {"items": {"type": "string"}, "type": "array"},
                    ],
                    "description": "(Optional) List of question-related files or reference materials",
                },
                "suggest_user_takeover": {
                    "type": "string",
                    "enum": ["none", "browser"],
                    "description": "(Optional) Suggested operation for user takeover",
                },
            },
            "required": ["text"],
        },
    },
    # ─────────────────────────────────────────────────────────
    # File System
    # ─────────────────────────────────────────────────────────
    {
        "name": "file_read",
        "description": (
            "Read file content. Use for checking file contents, analyzing "
            "logs, or reading configuration files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file": {"type": "string", "description": "Absolute path of the file to read"},
                "start_line": {
                    "type": "integer",
                    "description": "(Optional) Starting line to read from, 0-based",
                },
                "end_line": {
                    "type": "integer",
                    "description": "(Optional) Ending line number (exclusive)",
                },
            },
            "required": ["file"],
        },
    },
    {
        "name": "file_write",
        "description": (
            "Overwrite or append content to a file. Use for creating new files, "
            "appending content, or modifying existing files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file": {"type": "string", "description": "Absolute path of the file to write to"},
                "content": {"type": "string", "description": "Text content to write"},
                "append": {
                    "type": "boolean",
                    "description": "(Optional) Whether to use append mode",
                },
                "leading_newline": {
                    "type": "boolean",
                    "description": "(Optional) Whether to add a leading newline",
                },
                "trailing_newline": {
                    "type": "boolean",
                    "description": "(Optional) Whether to add a trailing newline",
                },
            },
            "required": ["file", "content"],
        },
    },
    {
        "name": "file_str_replace",
        "description": (
            "Replace specified string in a file. Use for updating specific "
            "content in files or fixing errors in code."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file": {"type": "string", "description": "Absolute path of the file to perform replacement on"},
                "old_str": {"type": "string", "description": "Original string to be replaced"},
                "new_str": {"type": "string", "description": "New string to replace with"},
            },
            "required": ["file", "old_str", "new_str"],
        },
    },
    {
        "name": "file_find_in_content",
        "description": (
            "Search for matching text within file content. Use for finding "
            "specific content or patterns in files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "file": {"type": "string", "description": "Absolute path of the file to search within"},
                "regex": {"type": "string", "description": "Regular expression pattern to match"},
            },
            "required": ["file", "regex"],
        },
    },
    {
        "name": "file_find_by_name",
        "description": (
            "Find files by name pattern in specified directory. Use for "
            "locating files with specific naming patterns."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Absolute path of directory to search"},
                "glob": {"type": "string", "description": "Filename pattern using glob syntax wildcards"},
            },
            "required": ["path", "glob"],
        },
    },
    # ─────────────────────────────────────────────────────────
    # Shell / Code Execution
    # ─────────────────────────────────────────────────────────
    {
        "name": "shell_exec",
        "description": (
            "Execute commands in a specified shell session. Use for running "
            "code, installing packages, or managing files."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique identifier of the target shell session",
                },
                "exec_dir": {
                    "type": "string",
                    "description": "Working directory for command execution (must use absolute path)",
                },
                "command": {"type": "string", "description": "Shell command to execute"},
            },
            "required": ["id", "exec_dir", "command"],
        },
    },
    {
        "name": "shell_view",
        "description": (
            "View the content of a specified shell session. Use for checking "
            "command execution results or monitoring output."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique identifier of the target shell session",
                },
            },
            "required": ["id"],
        },
    },
    {
        "name": "shell_wait",
        "description": (
            "Wait for the running process in a specified shell session to return. "
            "Use after running commands that require longer runtime."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique identifier of the target shell session",
                },
                "seconds": {
                    "type": "integer",
                    "description": "Wait duration in seconds",
                },
            },
            "required": ["id"],
        },
    },
    {
        "name": "shell_write_to_process",
        "description": (
            "Write input to a running process in a specified shell session. "
            "Use for responding to interactive command prompts."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique identifier of the target shell session",
                },
                "input": {
                    "type": "string",
                    "description": "Input content to write to the process",
                },
                "press_enter": {
                    "type": "boolean",
                    "description": "Whether to press Enter key after input",
                },
            },
            "required": ["id", "input", "press_enter"],
        },
    },
    {
        "name": "shell_kill_process",
        "description": (
            "Terminate a running process in a specified shell session. "
            "Use for stopping long-running processes or handling frozen commands."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Unique identifier of the target shell session",
                },
            },
            "required": ["id"],
        },
    },
    {
        "name": "code_execute",
        "description": (
            "Execute a code snippet in the sandbox. Supports Python, JavaScript, "
            "and Bash. Use for data processing, calculations, testing code snippets, "
            "or running scripts. Returns stdout, stderr, and exit code."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "language": {
                    "type": "string",
                    "enum": ["python", "javascript", "bash"],
                    "default": "python",
                },
                "timeout": {"type": "integer", "default": 30},
            },
            "required": ["code"],
        },
    },
    # ─────────────────────────────────────────────────────────
    # Web Search
    # ─────────────────────────────────────────────────────────
    {
        "name": "web_search",
        "description": (
            "Search web pages using search engine. Use for obtaining latest "
            "information or finding references."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query in Google search style, using 3-5 keywords.",
                },
                "date_range": {
                    "type": "string",
                    "enum": ["all", "past_hour", "past_day", "past_week", "past_month", "past_year"],
                    "description": "(Optional) Time range filter for search results.",
                },
                "num_results": {"type": "integer", "default": 5, "maximum": 10},
            },
            "required": ["query"],
        },
    },
    # ─────────────────────────────────────────────────────────
    # Browser (Full Interactive Suite)
    # ─────────────────────────────────────────────────────────
    {
        "name": "browser_view",
        "description": (
            "View content of the current browser page. Use for checking "
            "the latest state of previously opened pages."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "browser_navigate",
        "description": (
            "Navigate browser to specified URL. Use when accessing new pages "
            "is needed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Complete URL to visit. Must include protocol prefix.",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "browser_restart",
        "description": (
            "Restart browser and navigate to specified URL. Use when browser "
            "state needs to be reset."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "Complete URL to visit after restart. Must include protocol prefix.",
                },
            },
            "required": ["url"],
        },
    },
    {
        "name": "browser_click",
        "description": (
            "Click on elements in the current browser page. Use when clicking "
            "page elements is needed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "index": {
                    "type": "integer",
                    "description": "(Optional) Index number of the element to click",
                },
                "coordinate_x": {
                    "type": "number",
                    "description": "(Optional) X coordinate of click position",
                },
                "coordinate_y": {
                    "type": "number",
                    "description": "(Optional) Y coordinate of click position",
                },
            },
        },
    },
    {
        "name": "browser_input",
        "description": (
            "Overwrite text in editable elements on the current browser page. "
            "Use when filling content in input fields."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "index": {
                    "type": "integer",
                    "description": "(Optional) Index number of the element to overwrite text",
                },
                "coordinate_x": {
                    "type": "number",
                    "description": "(Optional) X coordinate of the element",
                },
                "coordinate_y": {
                    "type": "number",
                    "description": "(Optional) Y coordinate of the element",
                },
                "text": {"type": "string", "description": "Complete text content to overwrite"},
                "press_enter": {
                    "type": "boolean",
                    "description": "Whether to press Enter key after input",
                },
            },
            "required": ["text", "press_enter"],
        },
    },
    {
        "name": "browser_move_mouse",
        "description": (
            "Move cursor to specified position on the current browser page. "
            "Use when simulating user mouse movement."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "coordinate_x": {
                    "type": "number",
                    "description": "X coordinate of target cursor position",
                },
                "coordinate_y": {
                    "type": "number",
                    "description": "Y coordinate of target cursor position",
                },
            },
            "required": ["coordinate_x", "coordinate_y"],
        },
    },
    {
        "name": "browser_press_key",
        "description": (
            "Simulate key press in the current browser page. Use when specific "
            "keyboard operations are needed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "Key name to simulate (e.g., Enter, Tab, ArrowUp), supports key combinations (e.g., Control+Enter).",
                },
            },
            "required": ["key"],
        },
    },
    {
        "name": "browser_select_option",
        "description": (
            "Select specified option from dropdown list element in the current "
            "browser page. Use when selecting dropdown menu options."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "index": {
                    "type": "integer",
                    "description": "Index number of the dropdown list element",
                },
                "option": {
                    "type": "integer",
                    "description": "Option number to select, starting from 0.",
                },
            },
            "required": ["index", "option"],
        },
    },
    {
        "name": "browser_scroll_up",
        "description": (
            "Scroll up the current browser page. Use when viewing content "
            "above or returning to page top."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "to_top": {
                    "type": "boolean",
                    "description": "(Optional) Whether to scroll directly to page top instead of one viewport up.",
                },
            },
        },
    },
    {
        "name": "browser_scroll_down",
        "description": (
            "Scroll down the current browser page. Use when viewing content "
            "below or jumping to page bottom."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "to_bottom": {
                    "type": "boolean",
                    "description": "(Optional) Whether to scroll directly to page bottom instead of one viewport down.",
                },
            },
        },
    },
    {
        "name": "browser_console_exec",
        "description": (
            "Execute JavaScript code in browser console. Use when custom "
            "scripts need to be executed."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "javascript": {
                    "type": "string",
                    "description": "JavaScript code to execute. Note that the runtime environment is browser console.",
                },
            },
            "required": ["javascript"],
        },
    },
    {
        "name": "browser_console_view",
        "description": (
            "View browser console output. Use when checking JavaScript logs "
            "or debugging page errors."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "max_lines": {
                    "type": "integer",
                    "description": "(Optional) Maximum number of log lines to return.",
                },
            },
        },
    },
    {
        "name": "browser_screenshot",
        "description": (
            "Take a screenshot of the current browser page. Returns the "
            "screenshot as a base64-encoded image. Use for verifying website "
            "builds, checking UI rendering, or capturing visual content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "full_page": {"type": "boolean", "default": False},
            },
        },
    },
    # ─────────────────────────────────────────────────────────
    # Deployment
    # ─────────────────────────────────────────────────────────
    {
        "name": "deploy_expose_port",
        "description": (
            "Expose specified local port for temporary public access. Use "
            "when providing temporary public access for services."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "port": {
                    "type": "integer",
                    "description": "Local port number to expose",
                },
            },
            "required": ["port"],
        },
    },
    {
        "name": "deploy_apply_deployment",
        "description": (
            "Deploy website or application to public production environment. "
            "Use when deploying or updating static websites or applications."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["static", "nextjs"],
                    "description": "Type of website or application to deploy.",
                },
                "local_dir": {
                    "type": "string",
                    "description": "Absolute path of local directory to deploy.",
                },
            },
            "required": ["type", "local_dir"],
        },
    },
    # ─────────────────────────────────────────────────────────
    # Image Generation (Rubic Extra — not in Manus)
    # ─────────────────────────────────────────────────────────
    {
        "name": "generate_image",
        "description": (
            "Generate an image using AI. Creates high-quality images with "
            "accurate text rendering. Use for illustrations, diagrams, logos, "
            "UI mockups, or any visual content. The image is saved to the "
            "sandbox filesystem and can be served via deploy_expose_port."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Detailed description of the image to generate",
                },
                "filename": {
                    "type": "string",
                    "default": "generated_image.png",
                    "description": "Filename to save the image as in the sandbox",
                },
            },
            "required": ["prompt"],
        },
    },
    # ─────────────────────────────────────────────────────────
    # Employee Mode: Recurring Tasks (Rubic Extra)
    # ─────────────────────────────────────────────────────────
    {
        "name": "schedule_recurring_task",
        "description": (
            "Schedule a task to run automatically on a recurring basis. Use "
            "when the user wants ongoing/continuous work (e.g., 'post to "
            "social media every week', 'check email daily', 'monitor competitors')."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Name for this recurring task"},
                "description": {
                    "type": "string",
                    "description": "What the agent should do each time",
                },
                "skill_id": {
                    "type": "string",
                    "description": "Skill to execute (from a previously created skill)",
                },
                "schedule": {
                    "type": "string",
                    "enum": ["daily", "weekly", "biweekly", "monthly"],
                },
                "day_of_week": {
                    "type": "string",
                    "description": "For weekly: monday, tuesday, etc.",
                },
                "time": {
                    "type": "string",
                    "description": "Time in user's timezone, e.g., '09:00'",
                },
                "duration": {
                    "type": "string",
                    "description": "How long: '3 months', '6 months', 'indefinite'",
                },
            },
            "required": ["name", "description", "schedule"],
        },
    },
    # ─────────────────────────────────────────────────────────
    # Outcome Tracking (Rubic Extra)
    # ─────────────────────────────────────────────────────────
    {
        "name": "check_outcomes",
        "description": (
            "Check the results/engagement/analytics of previously completed work. "
            "Use at the start of recurring tasks to learn what worked and adjust strategy."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "enum": ["social_media", "email", "website", "custom"],
                },
                "platform": {
                    "type": "string",
                    "description": "Specific platform: twitter, instagram, etc.",
                },
                "timeframe": {"type": "string", "default": "last_7_days"},
            },
            "required": ["source"],
        },
    },
]


def get_tool_names() -> list[str]:
    """Return names of all core tools."""
    return [t["name"] for t in CORE_TOOLS]


def filter_tools_by_names(tools: list[dict], allowed_names: list[str]) -> list[dict]:
    """Filter a tool list to only include tools with the given names."""
    return [t for t in tools if t["name"] in allowed_names]
