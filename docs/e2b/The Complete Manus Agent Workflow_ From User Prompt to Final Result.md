# The Complete Manus Agent Workflow: From User Prompt to Final Result

**Author:** Manus AI
**Date:** February 9, 2026

## 1. Introduction

This document provides a comprehensive, deeply detailed explanation of the end-to-end workflow of the Manus agent. It addresses your questions about how user prompts are processed, how tools are executed within the sandbox, and specifically, how the state of each tool call (including visual screenshots) is captured, stored, and presented back to you in the user interface. This analysis is based on a synthesis of the documentation you provided (`agent-loop.md`, `modules.md`, `prompt.md`, `tools.json`) and the extensive internal audit of my own sandbox environment and its APIs.

## 2. High-Level System Architecture

The overall system can be broken down into three primary components: the **User Interface**, the **Manus Coordination Layer**, and the **E2B Sandbox Environment**. The interaction between these components forms the core agent loop.

![High-Level System Architecture](https://private-us-east-1.manuscdn.com/sessionFile/BUhy8hamZH3PeMgQOxte4C/sandbox/Qc0Sqn3woUV8xU55ctVxmF-images_1770630380648_na1fn_L2hvbWUvdWJ1bnR1L2hpZ2hfbGV2ZWxfYXJjaGl0ZWN0dXJl.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvQlVoeThoYW1aSDNQZU1nUU94dGU0Qy9zYW5kYm94L1FjMFNxbjN3b1VWOHhVNTVjdFZ4bUYtaW1hZ2VzXzE3NzA2MzAzODA2NDhfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyaHBaMmhmYkdWMlpXeGZZWEpqYUdsMFpXTjBkWEpsLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=l52l~r5jNkrx1R7M4hzn1CgVRcS-lAtP5v4b2l1wNKOUZK7fJCHmRITS2Wilj5zQyAU~EFwCL1MFDiV64pM-TIqIW3jecKorIJoJbX0HP~Bors32uBolWQ85OkWxCoBMOwpBuUBSYpWJkoyHcWPiy1SQ-PKHuMnzNhnlqXZGuFStHNIACA-MeEpk9Z7Eph2rhtHdHD6R3x8Fpdpee3li5V35wGv3uXDpXZ~-z5mba4iM23mRA21XDBSekCVZsE-SDoZdo~53cAkmxaSSOJHsDEIz-REXHPkJSa0YtVltUAWZbaYtqft-Ab4kbuaOi8YfUg~Ct~lXHAGspqOOvoo0nQ__)

1.  **User Message**: You initiate the process by sending a message through the chat interface.
2.  **Tool Call (Action)**: The Agent Core (the Large Language Model) receives your message, analyzes it, and decides which tool to use. It then sends a structured tool call (an "Action") to the Sandbox Runtime API.
3.  **Result (Observation)**: The Sandbox executes the action and returns the result (an "Observation") to the Agent Core. This observation contains the output of the command, and for browser actions, a screenshot and other state information.
4.  **Store State**: The Coordination Layer intercepts this observation and stores the screenshot and associated state in a database.
5.  **Display State**: The User Interface is notified of the new state and displays it, for example, as the clickable "browsing" tab showing the screenshot of the last browser action.
6.  **Agent Response**: The Agent Core processes the observation and sends a natural language response back to you through the chat interface.

## 3. The Agent Loop in Detail

As described in `agent-loop.md`, my operation is an iterative process. Let's walk through a concrete example: you ask me to find information on a website.

**Your Prompt:** "Please go to example.com and tell me what the main headline is."

### Step 1: Analyze Events (Coordination Layer)

*   Your message arrives as a `Message` event in the event stream.
*   The **Agent Core (LLM)** analyzes this message. It recognizes the intent to browse a website and extract information.

### Step 2: Select Tools (Coordination Layer)

*   Based on the analysis, the Agent Core selects the `browser_navigate` tool.
*   It constructs a tool call (an "Action") that looks like this in my internal thought process:
    ```python
    default_api.browser_navigate(url="https://example.com", intent="informational", focus="main headline")
    ```

### Step 3: Wait for Execution (Sandbox Environment)

This is where the process enters the E2B Sandbox, and it's the core of your question.

1.  **API Request**: The Coordination Layer sends a POST request to the **Sandbox Runtime API** at `http://localhost:8330/browser/action`.
2.  **Request Body**: The body of this request is a JSON object containing the action details. Crucially, it also includes pre-signed URLs for uploading the screenshots that will be taken.
    ```json
    {
      "action": {
        "browser_navigate": {
          "url": "https://example.com"
        }
      },
      "screenshot_presigned_url": "https://s3.amazonaws.com/manus-screenshots/...",
      "clean_screenshot_presigned_url": "https://s3.amazonaws.com/manus-screenshots/..."
    }
    ```
3.  **CDP Execution**: The Sandbox Runtime receives this request and translates it into a command for the headless Chrome browser via the **Chrome DevTools Protocol (CDP)** on port `9222`.
4.  **Action & Capture**: The browser navigates to `example.com`. Immediately after the page loads, the Sandbox Runtime issues two more CDP commands:
    *   `Page.captureScreenshot`: This takes a screenshot of the current viewport. One screenshot includes annotations (the numbered boxes on interactive elements), and one is a "clean" version without them.
    *   The Sandbox Runtime also injects a content script via the `manus-helper` Chrome extension to extract the page's text content as Markdown.
5.  **Upload Screenshots**: The Sandbox Runtime uploads the two captured screenshot images directly to the provided pre-signed S3 URLs.
6.  **Return Observation**: The Sandbox Runtime packages the result—including the extracted Markdown content, the list of interactive elements, and the URLs of the now-uploaded screenshots—into a JSON object.
7.  **API Response**: This JSON object is sent back to the Coordination Layer as the response to the initial API call. This is the "Observation" event.

### Step 4: Iterate (Coordination Layer & UI)

*   The **Agent Core** receives the Observation. It now has the text content of the page.
*   Simultaneously, the **Coordination Layer**'s state management service sees the screenshot URLs in the observation. It updates the central state database, associating this tool call with its resulting screenshot.
*   The **User Interface** is subscribed to these state updates. It receives the new screenshot URL and displays it in the chat history as the interactive "browsing" tab.
*   The Agent Core analyzes the extracted Markdown, finds the main headline, and formulates a response.
*   It then selects the `message` tool to send the answer back to you.

### Step 5 & 6: Submit Results & Standby

*   The `message` tool call is executed, and you see my response in the chat.
*   The task is complete, and I enter a standby state, awaiting your next message.

## 4. Tool-Specific Flows

While the browser flow is the most complex, other tools follow a similar pattern, mapping high-level tool calls to specific Sandbox Runtime API endpoints.

| Tool Category | Agent Tool Call(s) | Sandbox Runtime API Endpoint | Sandbox Internal Action |
| :--- | :--- | :--- | :--- |
| **File System** | `file(action='read', ...)`<br>`file(action='write', ...)`<br>`match(action='grep', ...)` | `POST /text_editor` | The runtime directly uses Python's `os` and `subprocess` modules to perform file I/O and run `grep`. |
| **Shell/Terminal** | `shell(action='exec', ...)`<br>`shell(action='view', ...)` | `POST /terminal/{id}/write`<br>`GET /terminal/{id}/view` | The runtime manages persistent `pty` (pseudo-terminal) sessions. It writes commands to the pty's stdin and reads the output from its stdout. |
| **Data Analysis** | `shell(command='python3 ...')` | `POST /terminal/{id}/write` | This is a specialized use of the shell tool. The Python script is first written to a file using the `file` tool, then executed via the terminal API. |
| **Web Extraction** | `browser_navigate`, `browser_click`, etc. | `POST /browser/action` | As detailed above, this endpoint uses the Chrome DevTools Protocol (CDP) to control the browser, capture state, and extract content. |

## 5. What You Did "Wrong"

Your initial assumption that my E2B sandbox was tied *only* to the IDE was a slight misinterpretation, which is completely understandable. The key clarification is that the sandbox is a complete, isolated Linux environment that *contains* multiple services working in concert:

*   **The IDE (Code Server)**: This is one service, accessible to you for development, but I do not use it myself.
*   **The Live View (Neko)**: This provides the VNC-like stream for you to observe the desktop, but again, I do not use it for my operations.
*   **The Sandbox Runtime API**: This is the private, programmatic interface that I, the agent, use to execute all my tool-based work.

Your mistake was in not initially separating the **user-facing interfaces** (IDE, Live View) from the **agent-facing API**. My programmatic tool execution is entirely headless and API-driven, which is far more efficient and robust than trying to parse a visual video stream or control a GUI.

## 6. Conclusion

The Manus system is a sophisticated orchestration of a powerful language model, a flexible event-driven architecture, and a secure, multi-service sandbox environment. The magic of displaying the browser's state in the UI lies in the `sandbox-runtime` API's ability to not only execute a browser command but also to capture the resulting state (as a screenshot and text) and pass that information back up the chain. The Coordination Layer then acts as the central nervous system, routing that state information both to the UI for you to see and back to the Agent Core for me to continue the task. This creates a seamless and transparent workflow, giving you a clear window into the execution of your requests.
