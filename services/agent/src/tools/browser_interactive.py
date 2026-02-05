"""
Interactive browser tools — full browser automation via Playwright in E2B sandbox.

Maintains a persistent browser session in the sandbox using a small HTTP
controller server. The controller keeps a Playwright browser + page alive
between tool calls.

Architecture:
1. First browser tool call → starts the controller in the sandbox (port 9821)
2. Subsequent calls → HTTP to the controller → Playwright actions → JSON response
3. Controller auto-indexes interactive elements as `index[N]:<tag>text</tag>`
"""

import json
import textwrap

import httpx
import structlog

from ..config import settings

logger = structlog.get_logger()

# Port for the browser controller inside the sandbox
BROWSER_CONTROLLER_PORT = 9821

# Controller server source — runs inside E2B sandbox
BROWSER_CONTROLLER_SCRIPT = textwrap.dedent(r'''
import asyncio
import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading

# Global state
page = None
browser = None
playwright_instance = None
console_logs = []
MAX_CONSOLE_LOGS = 200


def sync_handler_factory():
    """Create HTTP handler that dispatches to async Playwright operations."""

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length else {}
            action = self.path.strip("/")

            try:
                result = asyncio.get_event_loop().run_until_complete(
                    dispatch(action, body)
                )
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e), "traceback": traceback.format_exc()}).encode())

        def log_message(self, format, *args):
            pass  # Suppress HTTP logs

    return Handler


async def ensure_browser():
    """Launch browser if not already running."""
    global page, browser, playwright_instance, console_logs
    if browser is None or not browser.is_connected():
        from playwright.async_api import async_playwright
        playwright_instance = await async_playwright().start()
        browser = await playwright_instance.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(viewport={"width": 1280, "height": 720})
        page = await ctx.new_page()
        console_logs = []

        # Capture console logs
        page.on("console", lambda msg: console_logs.append({
            "type": msg.type,
            "text": msg.text,
        }) if len(console_logs) < MAX_CONSOLE_LOGS else None)


async def get_page_content():
    """Extract page content with indexed interactive elements."""
    global page
    if not page:
        return {"error": "No page loaded. Use navigate first."}

    # Inject element indexing script
    result = await page.evaluate(r"""() => {
        const elements = [];
        const interactiveSelectors = 'a, button, input, select, textarea, [role="button"], [onclick], [tabindex]';
        const allInteractive = document.querySelectorAll(interactiveSelectors);

        allInteractive.forEach((el, idx) => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                const tag = el.tagName.toLowerCase();
                const text = (el.textContent || el.value || el.placeholder || el.alt || '').trim().slice(0, 100);
                const type = el.type || '';
                elements.push({
                    index: idx,
                    tag: tag,
                    type: type,
                    text: text,
                    x: Math.round(rect.x + rect.width / 2),
                    y: Math.round(rect.y + rect.height / 2),
                });
            }
        });

        // Get page text
        const bodyText = document.body ? document.body.innerText : '';

        return {
            title: document.title,
            url: window.location.href,
            elements: elements,
            bodyText: bodyText.slice(0, 15000),
        };
    }""")

    # Format elements as indexed list
    formatted_elements = []
    for el in result.get("elements", []):
        tag = el["tag"]
        text = el["text"]
        idx = el["index"]
        type_str = f' type="{el["type"]}"' if el.get("type") else ""
        formatted_elements.append(f'index[{idx}]:<{tag}{type_str}>{text}</{tag}>')

    return {
        "title": result.get("title", ""),
        "url": result.get("url", ""),
        "elements": formatted_elements[:100],  # Cap at 100 elements
        "content": result.get("bodyText", "")[:10000],
    }


async def dispatch(action, body):
    """Dispatch browser action."""
    global page, browser, playwright_instance, console_logs

    if action == "navigate":
        await ensure_browser()
        url = body.get("url", "about:blank")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(1000)  # Let JS settle
        return await get_page_content()

    elif action == "restart":
        # Kill existing browser, start fresh
        if browser and browser.is_connected():
            await browser.close()
        if playwright_instance:
            await playwright_instance.stop()
        browser = None
        playwright_instance = None
        page = None
        console_logs = []
        await ensure_browser()
        url = body.get("url", "about:blank")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(1000)
        return await get_page_content()

    elif action == "view":
        await ensure_browser()
        return await get_page_content()

    elif action == "click":
        await ensure_browser()
        if "index" in body:
            # Click by element index
            idx = body["index"]
            await page.evaluate(f"""() => {{
                const els = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick], [tabindex]');
                const visible = Array.from(els).filter(el => {{
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                }});
                if (visible[{idx}]) visible[{idx}].click();
            }}""")
        elif "coordinate_x" in body and "coordinate_y" in body:
            await page.mouse.click(body["coordinate_x"], body["coordinate_y"])
        await page.wait_for_timeout(500)
        return await get_page_content()

    elif action == "input":
        await ensure_browser()
        text = body.get("text", "")
        if "index" in body:
            idx = body["index"]
            await page.evaluate(f"""() => {{
                const els = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick], [tabindex]');
                const visible = Array.from(els).filter(el => {{
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                }});
                const el = visible[{idx}];
                if (el) {{
                    el.focus();
                    el.value = '';
                }}
            }}""")
            # Use keyboard to type (triggers JS events)
            await page.keyboard.type(text, delay=10)
        elif "coordinate_x" in body and "coordinate_y" in body:
            await page.mouse.click(body["coordinate_x"], body["coordinate_y"])
            await page.keyboard.press("Control+a")
            await page.keyboard.type(text, delay=10)
        if body.get("press_enter"):
            await page.keyboard.press("Enter")
        await page.wait_for_timeout(300)
        return await get_page_content()

    elif action == "move_mouse":
        await ensure_browser()
        await page.mouse.move(body["coordinate_x"], body["coordinate_y"])
        return {"moved_to": {"x": body["coordinate_x"], "y": body["coordinate_y"]}}

    elif action == "press_key":
        await ensure_browser()
        key = body.get("key", "Enter")
        await page.keyboard.press(key)
        await page.wait_for_timeout(300)
        return await get_page_content()

    elif action == "select_option":
        await ensure_browser()
        idx = body.get("index", 0)
        option = body.get("option", 0)
        await page.evaluate(f"""() => {{
            const els = document.querySelectorAll('select');
            const visible = Array.from(els).filter(el => {{
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            }});
            const el = visible[{idx}];
            if (el && el.options[{option}]) {{
                el.selectedIndex = {option};
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}
        }}""")
        await page.wait_for_timeout(300)
        return await get_page_content()

    elif action == "scroll_up":
        await ensure_browser()
        if body.get("to_top"):
            await page.evaluate("window.scrollTo(0, 0)")
        else:
            await page.evaluate("window.scrollBy(0, -window.innerHeight)")
        await page.wait_for_timeout(300)
        return await get_page_content()

    elif action == "scroll_down":
        await ensure_browser()
        if body.get("to_bottom"):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        else:
            await page.evaluate("window.scrollBy(0, window.innerHeight)")
        await page.wait_for_timeout(300)
        return await get_page_content()

    elif action == "console_exec":
        await ensure_browser()
        js = body.get("javascript", "")
        result = await page.evaluate(js)
        return {"result": str(result) if result is not None else "undefined"}

    elif action == "console_view":
        max_lines = body.get("max_lines", 50)
        return {"logs": console_logs[-max_lines:]}

    elif action == "screenshot":
        await ensure_browser()
        import base64
        full_page = body.get("full_page", False)
        img_bytes = await page.screenshot(full_page=full_page)
        return {
            "screenshot": base64.b64encode(img_bytes).decode(),
            "full_page": full_page,
        }

    elif action == "health":
        return {"status": "ok", "has_browser": browser is not None and browser.is_connected()}

    else:
        return {"error": f"Unknown action: {action}"}


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # Start browser eagerly
    loop.run_until_complete(ensure_browser())

    server = HTTPServer(("0.0.0.0", 9821), sync_handler_factory())
    print(json.dumps({"status": "browser_controller_started", "port": 9821}))
    sys.stdout.flush()
    server.serve_forever()
''')


async def _sandbox_shell(sandbox_id: str, command: str, timeout: int = 30) -> dict:
    """Execute a shell command in the sandbox."""
    async with httpx.AsyncClient(timeout=timeout + 10) as client:
        resp = await client.post(
            f"{settings.sandbox_service_url}/sandboxes/{sandbox_id}/shell",
            json={"command": command, "timeout": timeout * 1000},
        )
        if resp.status_code >= 400:
            return {"error": f"Shell failed: {resp.text}"}
        return resp.json()


async def _sandbox_write_file(sandbox_id: str, path: str, content: str) -> dict:
    """Write a file to the sandbox."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{settings.sandbox_service_url}/sandboxes/{sandbox_id}/files/write",
            json={"path": path, "content": content},
        )
        if resp.status_code >= 400:
            return {"error": f"Write failed: {resp.text}"}
        return resp.json()


async def _ensure_controller_running(sandbox_id: str) -> bool:
    """Ensure the browser controller is running in the sandbox."""
    # Check if already running
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            # Try to reach controller via sandbox shell (curl)
            resp = await client.post(
                f"{settings.sandbox_service_url}/sandboxes/{sandbox_id}/shell",
                json={
                    "command": f"curl -s http://localhost:{BROWSER_CONTROLLER_PORT}/health 2>/dev/null || echo NOTRUNNING",
                    "timeout": 5000,
                },
            )
            if resp.status_code == 200:
                stdout = resp.json().get("stdout", "")
                if "ok" in stdout:
                    return True
    except Exception:
        pass

    # Controller not running — start it
    logger.info("browser_controller_starting", sandbox_id=sandbox_id)

    # Write controller script
    await _sandbox_write_file(sandbox_id, "/tmp/browser_controller.py", BROWSER_CONTROLLER_SCRIPT)

    # Install playwright if needed & start controller in background
    startup_cmd = (
        "pip install playwright -q 2>/dev/null; "
        "python -m playwright install chromium 2>/dev/null; "
        f"nohup python /tmp/browser_controller.py > /tmp/browser_controller.log 2>&1 &"
    )
    await _sandbox_shell(sandbox_id, startup_cmd, timeout=120)

    # Wait for controller to be ready
    import asyncio
    for _ in range(20):
        await asyncio.sleep(1)
        try:
            check_resp = await _sandbox_shell(
                sandbox_id,
                f"curl -s http://localhost:{BROWSER_CONTROLLER_PORT}/health 2>/dev/null",
                timeout=5,
            )
            stdout = check_resp.get("stdout", "")
            if "ok" in stdout:
                logger.info("browser_controller_ready", sandbox_id=sandbox_id)
                return True
        except Exception:
            pass

    logger.warning("browser_controller_failed_to_start", sandbox_id=sandbox_id)
    return False


async def browser_action(sandbox_id: str | None, action: str, params: dict) -> dict:
    """
    Execute a browser action via the controller.
    This is the unified entry point for all interactive browser tools.
    """
    if not sandbox_id:
        return {"error": "No sandbox available. Browser tools require a sandbox."}

    # Ensure controller is running
    ready = await _ensure_controller_running(sandbox_id)
    if not ready:
        return {"error": "Browser controller failed to start in sandbox."}

    # Send action to controller via sandbox shell (curl)
    params_json = json.dumps(params).replace("'", "'\\''")  # Escape for shell
    curl_cmd = (
        f"curl -s -X POST http://localhost:{BROWSER_CONTROLLER_PORT}/{action} "
        f"-H 'Content-Type: application/json' "
        f"-d '{params_json}'"
    )

    result = await _sandbox_shell(sandbox_id, curl_cmd, timeout=45)
    stdout = result.get("stdout", "")

    if stdout.strip():
        try:
            return json.loads(stdout.strip())
        except json.JSONDecodeError:
            return {"output": stdout, "raw": True}

    stderr = result.get("stderr", "")
    if stderr:
        return {"error": stderr}

    return {"error": "No response from browser controller"}
