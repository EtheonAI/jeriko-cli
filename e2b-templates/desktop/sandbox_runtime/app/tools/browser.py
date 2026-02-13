"""Browser tool — Manus parity via Playwright CDP.

Endpoints:
  GET  /browser/status
  POST /browser/action
  POST /clear-browser-data
  POST /notify-manus-browser-config-update
"""

import asyncio
import os
import json
import subprocess
from typing import Any

from fastapi import APIRouter, Request

from ..logger import get_logger

logger = get_logger("browser")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")
CHROME_PATH = os.getenv("CHROME_INSTANCE_PATH", "/usr/bin/chromium-browser")
CDP_PORT = 9222

# Browser state
_browser = None
_context = None
_page = None


async def _get_playwright():
    """Lazy-import playwright to avoid startup cost if browser isn't used."""
    try:
        from playwright.async_api import async_playwright
        return async_playwright
    except ImportError:
        return None


async def _ensure_browser():
    """Ensure browser is launched and return the active page."""
    global _browser, _context, _page

    if _page is not None:
        try:
            await _page.title()
            return _page
        except Exception:
            _page = None
            _context = None
            _browser = None

    pw_factory = await _get_playwright()
    if pw_factory is None:
        raise RuntimeError("Playwright not installed")

    pw = await pw_factory().__aenter__()
    _browser = await pw.chromium.launch(
        executable_path=CHROME_PATH,
        headless=False,
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            f"--remote-debugging-port={CDP_PORT}",
            "--disable-gpu",
            "--window-size=1280,720",
            f"--user-data-dir={HOME}/.browser_data_dir",
        ],
    )
    _context = await _browser.new_context(
        viewport={"width": 1280, "height": 720},
        user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    )
    _page = await _context.new_page()
    return _page


async def _take_screenshot() -> str | None:
    """Take a screenshot and return the file path."""
    if _page is None:
        return None
    try:
        path = os.path.join(HOME, "screenshots", "screenshot.png")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        await _page.screenshot(path=path, full_page=False)
        return path
    except Exception as e:
        logger.warning("Screenshot failed: %s", e)
        return None


async def _handle_action(action: str, body: dict[str, Any]) -> dict[str, Any]:
    """Route browser action to appropriate handler."""

    if action == "navigate":
        page = await _ensure_browser()
        url = body.get("url", "")
        if not url:
            return {"error": "url is required"}
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            title = await page.title()
            current_url = page.url
            screenshot = await _take_screenshot()
            return {
                "ok": True,
                "title": title,
                "url": current_url,
                "screenshot": screenshot,
            }
        except Exception as e:
            return {"error": str(e)}

    elif action == "view":
        page = await _ensure_browser()
        try:
            title = await page.title()
            url = page.url
            # Get page content (text only)
            content = await page.evaluate("document.body?.innerText || ''")
            screenshot = await _take_screenshot()
            return {
                "ok": True,
                "title": title,
                "url": url,
                "content": content[:10000] if content else "",
                "screenshot": screenshot,
            }
        except Exception as e:
            return {"error": str(e)}

    elif action == "click":
        page = await _ensure_browser()
        coord = body.get("coordinate")
        if not coord or len(coord) < 2:
            return {"error": "coordinate [x, y] is required"}
        try:
            await page.mouse.click(coord[0], coord[1])
            await asyncio.sleep(0.5)
            screenshot = await _take_screenshot()
            return {"ok": True, "screenshot": screenshot}
        except Exception as e:
            return {"error": str(e)}

    elif action == "input":
        page = await _ensure_browser()
        text = body.get("text", "")
        coord = body.get("coordinate")
        if coord and len(coord) >= 2:
            await page.mouse.click(coord[0], coord[1])
            await asyncio.sleep(0.2)
        try:
            # Clear existing text and type new
            await page.keyboard.press("Control+a")
            await page.keyboard.type(text)
            await asyncio.sleep(0.3)
            screenshot = await _take_screenshot()
            return {"ok": True, "screenshot": screenshot}
        except Exception as e:
            return {"error": str(e)}

    elif action in ("scroll_up", "scroll_down", "scroll"):
        page = await _ensure_browser()
        amount = body.get("amount", 3)
        direction = body.get("direction", "down" if action != "scroll_up" else "up")
        if action == "scroll":
            direction = body.get("direction", "down")
        delta = -amount * 100 if direction == "up" else amount * 100
        try:
            coord = body.get("coordinate")
            x = coord[0] if coord and len(coord) >= 2 else 640
            y = coord[1] if coord and len(coord) >= 2 else 360
            await page.mouse.wheel(0, delta)
            await asyncio.sleep(0.3)
            screenshot = await _take_screenshot()
            return {"ok": True, "screenshot": screenshot}
        except Exception as e:
            return {"error": str(e)}

    elif action == "move_mouse":
        page = await _ensure_browser()
        coord = body.get("coordinate")
        if not coord or len(coord) < 2:
            return {"error": "coordinate [x, y] is required"}
        try:
            await page.mouse.move(coord[0], coord[1])
            return {"ok": True}
        except Exception as e:
            return {"error": str(e)}

    elif action in ("key_press", "press_key"):
        page = await _ensure_browser()
        key = body.get("key", "")
        if not key:
            return {"error": "key is required"}
        try:
            await page.keyboard.press(key)
            await asyncio.sleep(0.3)
            screenshot = await _take_screenshot()
            return {"ok": True, "screenshot": screenshot}
        except Exception as e:
            return {"error": str(e)}

    elif action == "select_option":
        page = await _ensure_browser()
        selector = body.get("selector", "")
        value = body.get("value", "")
        if not selector:
            return {"error": "selector is required"}
        try:
            await page.select_option(selector, value)
            await asyncio.sleep(0.3)
            screenshot = await _take_screenshot()
            return {"ok": True, "screenshot": screenshot}
        except Exception as e:
            return {"error": str(e)}

    elif action == "console_exec":
        page = await _ensure_browser()
        script = body.get("script", "")
        if not script:
            return {"error": "script is required"}
        try:
            result = await page.evaluate(script)
            return {"ok": True, "result": result}
        except Exception as e:
            return {"error": str(e)}

    elif action == "console_view":
        # Return empty — console log capture not yet implemented
        return {"ok": True, "logs": []}

    elif action == "screenshot":
        page = await _ensure_browser()
        screenshot = await _take_screenshot()
        return {"ok": True, "screenshot": screenshot}

    elif action == "restart":
        global _browser, _context, _page
        if _browser:
            try:
                await _browser.close()
            except Exception:
                pass
        _browser = None
        _context = None
        _page = None
        return {"ok": True, "message": "Browser restarted"}

    else:
        return {"error": f"Unknown browser action: {action}"}


@router.get("/browser/status")
async def browser_status() -> dict[str, Any]:
    running = _page is not None
    pid = None
    try:
        result = subprocess.run(
            ["pgrep", "-f", "chromium|chrome"],
            capture_output=True, text=True, timeout=2,
        )
        pid = result.stdout.strip().split("\n")[0] if result.stdout.strip() else None
        running = running or bool(pid)
    except Exception:
        pass
    return {"running": running, "pid": pid, "nekoPort": 8333}


@router.post("/browser/action")
async def browser_action(request: Request) -> dict[str, Any]:
    body = await request.json()
    action = body.get("action", "")
    if not action:
        return {"error": "action is required"}
    try:
        return await _handle_action(action, body)
    except Exception as e:
        logger.error("Browser action error [%s]: %s", action, e)
        return {"error": str(e), "action": action}


@router.post("/clear-browser-data")
async def clear_browser_data() -> dict[str, Any]:
    try:
        subprocess.run(
            f"rm -rf {HOME}/.browser_data_dir/* {HOME}/.search_cache/* 2>/dev/null",
            shell=True, timeout=5,
        )
    except Exception:
        pass
    return {"ok": True}


@router.post("/notify-manus-browser-config-update")
async def browser_config_update(request: Request) -> dict[str, Any]:
    body = await request.json()
    config_path = os.path.join(HOME, ".browser_data_dir", "config.json")
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    config = body.get("config", body)
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    return {"ok": True}
