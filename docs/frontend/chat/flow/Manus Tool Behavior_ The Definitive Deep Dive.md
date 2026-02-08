# Manus Tool Behavior: The Definitive Deep Dive

You are right to ask for this level of detail. The difference between `search` and `browser_navigate`, and how various UI elements appear, is not a summary — it is the core of how I work. This document provides the complete, in-depth explanation of my actual behavior.

---

## Core Principle: Two Rendering Surfaces

Everything I do renders onto one of two surfaces. Understanding this is key:

1.  **The Chat Stream**: This is the primary message area. It renders the final text response, but also specialized, inline UI components for specific tools (`<Sources>`, `<Plan>`, `<Image>`, `<FileAttachment>`).
2.  **The Canvas Panel (The "Computer")**: This is the right-hand panel. It provides a **live view into the sandbox environment** where the work is actually happening. It shows the Browser, the Terminal, or the Code IDE.

The chat stream shows the **results and artifacts**. The canvas shows the **process**.

---

## The Complete Tool Table: In Full Depth

This is not a summary. This is the exact logic I follow for every tool call.

| Tool & Category | Trigger & In-Depth Logic | Chat Rendering | Canvas Rendering |
| :--- | :--- | :--- | :--- |
| **`search`** <br> *Information Gathering* | **When I need to discover unknown information.** I use this for open-ended questions ("What are the best laptops in 2026?"), fact-checking, or finding multiple perspectives. I do **not** know the URLs beforehand. The goal is to get a list of potential sources to investigate further. | A `<Sources>` component appears, listing numbered results with titles, snippets, and favicons. The final text response will use these numbers as inline citations (e.g., `[1] [2]`). | **Terminal View**. The canvas shows the `search` command being executed, including the exact queries I used. It does **not** open the browser. |
| **`browser_navigate`** <br> *Information Gathering* | **When I know the exact URL to visit.** This is triggered after a `search` (to visit one of the results), or when a user provides a direct link. The goal is to read the content of a *specific* page. | A compact `<Tool>` card showing "Navigating to [URL]...". It does **not** show the page content in the chat. | **Browser View**. The canvas immediately opens the browser, showing a live screenshot of the page, the URL bar, and extracted Markdown content. |
| **`file.write` / `file.read`** <br> *File System* | When I need to create, read, or modify a file inside the sandbox. This is for scripts, notes, or data persistence. | A compact `<Tool>` card showing "Writing file..." or "Reading file...". It does **not** show the file content in the chat. | **Code IDE View**. The canvas opens the full IDE, with the file tree on the left and the content of the file being read/written in a Monaco editor tab on the right. |
| **`shell.exec`** <br> *Code & Execution* | When I need to run a command-line operation: `ls`, `pip install`, `npm run build`, `manus-mcp-cli`, etc. This is the workhorse for all sandbox interactions. | A compact `<Tool>` card showing "Executing command...". | **Terminal View**. The canvas opens the terminal, showing the command being typed and the live, streaming output with full ANSI color support. |
| **`message` (with `attachments`)** <br> *Communication* | When I need to deliver a final file to you. This is **not** a tool call that operates on a file; it is the final delivery mechanism. The file path in the `attachments` array must exist in the sandbox. | **File Attachment Cards**. The chat renders one or more rich file cards, showing the filename, icon, and size. This is a distinct UI from a tool call. | **No Canvas Change**. The canvas is not affected by a `message` call. |
| **`manus-mcp-cli tool call gmail.read_email`** <br> *Integrations (MCP)* | When you ask me to check your email. I use the `shell.exec` tool to run the `manus-mcp-cli` command. | **Custom Email Preview Component**. My UI has a special renderer mapped to the `gmail.read_email` tool name. It shows a rich preview with sender, subject, and a snippet. It is **not** a generic tool box. | **Terminal View**. The canvas shows the `manus-mcp-cli tool call ...` command being executed in the terminal. |

---

## Deep Dive: Search vs. Browse — A Head-to-Head Comparison

This is the most critical distinction.

| Feature | `search` Flow | `browser_navigate` Flow |
| :--- | :--- | :--- |
| **Trigger** | User asks: "Find me articles about AI agents." | User asks: "Go to https://ai-sdk.dev." |
| **Tool Call** | `print(default_api.search(queries=["AI agent articles"]))` | `print(default_api.browser_navigate(url="https://ai-sdk.dev"))` |
| **Canvas View** | **Terminal** showing the search queries. | **Browser** showing a screenshot of ai-sdk.dev. |
| **Chat UI** | A `<Sources>` component with 10 links appears. | A compact `<Tool>` card saying "Navigating..." appears. |
| **Next Step** | I analyze the search results and then call `browser_navigate` on the most promising link (e.g., result #3). | I read the content from the browser view and answer the user's question. |

**In short: `search` gives me a list of places to go. `browser_navigate` takes me to one of them.**

---

## Deep Dive: How Files Are Rendered — The Three Contexts

Seeing a file can mean three different things:

1.  **Operating on a File (`file.write`)**: When I am actively working on a file, the **canvas** shows the **Code IDE**. The chat shows a compact tool status.
2.  **Delivering a File (`message`)**: When the work is done and I am giving you the final result, the **chat** shows a rich **File Attachment Card**. The canvas is not involved.
3.  **Displaying Code in a Response**: When I include a code snippet in my final text answer, the **chat** renders it in a `<CodeBlock>` with syntax highlighting. This is part of the text content, not a tool or an attachment.

By understanding these distinctions, you can see the logic behind why my UI changes for each specific action. It's a system designed to show you the most relevant information — the process in the canvas, and the results in the chat — at every step.
