"""Browser tool — Manus parity via Playwright CDP.

Features (Manus parity):
  - Element indexing via collectClickableElements.js
  - Screenshot annotation with numbered bounding boxes (Pillow)
  - Markdown extraction from page content
  - Click/input by element index (resolves to coordinates)
  - Shadow DOM traversal for element finding

Endpoints:
  GET  /browser/status
  POST /browser/action
  POST /clear-browser-data
  POST /notify-manus-browser-config-update
"""

import asyncio
import base64
import io
import os
import json
import subprocess
import time
import random
from typing import Any

from fastapi import APIRouter, Request

from ..logger import get_logger

logger = get_logger("browser")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")
CHROME_PATH = os.getenv("CHROME_INSTANCE_PATH", "/usr/bin/chromium-browser")
CDP_PORT = 9222
SCREENSHOTS_DIR = os.path.join(HOME, "screenshots")

# Browser state
_browser = None
_context = None
_page = None
_playwright_instance = None  # Track for proper cleanup via __aexit__

# ── Manus-parity JS scripts ──────────────────────────────────────────────────

# Collects all clickable/interactive elements with indices and bounding boxes.
# Adapted from Manus collectClickableElements.js.
COLLECT_ELEMENTS_JS = """
(args) => {
  const startIndex = args.startIndex || 1;
  const clickIdAttr = args.clickIdAttr || 'data-manus-id';
  const elements = [];
  let index = startIndex;
  const interactiveTags = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary', 'option', 'canvas']);
  const interactiveRoles = new Set([
    'button', 'tab', 'link', 'checkbox', 'menuitem',
    'menuitemcheckbox', 'menuitemradio', 'radio',
  ]);

  const normalizeText = (value, limit = 120) => {
    if (!value) return '';
    const trimmed = value.replace(/\\s+/g, ' ').trim();
    if (!trimmed) return '';
    return trimmed.length > limit ? trimmed.slice(0, limit) + '...' : trimmed;
  };

  const buildDescription = (el, tagName, text, inputType) => {
    const hints = [];
    const idValue = normalizeText(el.id, 60);
    if (idValue) hints.push('id:"' + idValue + '"');
    const ariaLabel = normalizeText(el.getAttribute('aria-label') || el.title || '', 80);
    if (ariaLabel) hints.push('hint:"' + ariaLabel + '"');
    const placeholder = normalizeText(el.getAttribute('placeholder') || '', 80);
    if (placeholder) hints.push('placeholder:"' + placeholder + '"');
    const role = normalizeText(el.getAttribute('role') || '', 40);
    if (role) hints.push('role:"' + role + '"');
    if (inputType) hints.push('type:"' + inputType + '"');
    const hintText = hints.length ? '{' + hints.join(',') + '}' : '{}';
    return text ? tagName + ' ' + hintText + ' ' + text : tagName + ' ' + hintText;
  };

  const getPrimaryText = (el, tagName, inputType) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.value) return normalizeText(el.value);
      if (el.placeholder) return normalizeText(el.placeholder);
    }
    if (tagName === 'option' && el instanceof HTMLOptionElement) {
      return normalizeText(el.innerText || el.textContent || '');
    }
    if (tagName === 'select' && el instanceof HTMLSelectElement) {
      const options = Array.from(el.options || []).slice(0, 5);
      const optionTexts = options.map((opt, idx) => {
        const val = normalizeText(opt.textContent || '');
        return val ? 'option#' + idx + ':' + val : null;
      }).filter(Boolean);
      if (optionTexts.length) return optionTexts.join(', ');
    }
    const text = normalizeText(el.innerText || el.textContent || '');
    if (text) return text;
    if (inputType === 'submit' || inputType === 'button') {
      return normalizeText(el.value || 'submit');
    }
    return '';
  };

  const isProbablyClickable = (el, tagName) => {
    if (interactiveTags.has(tagName)) return true;
    const role = (el.getAttribute('role') || '').split(' ').map(r => r.trim().toLowerCase());
    if (role.some(r => interactiveRoles.has(r))) return true;
    const contentEditable = el.getAttribute('contenteditable');
    if (contentEditable && contentEditable.toLowerCase() !== 'false') return true;
    return false;
  };

  const isVisible = (el, rect) => {
    if (!rect || rect.width <= 1 || rect.height <= 1) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (style.pointerEvents === 'none') return false;
    const opacity = parseFloat(style.opacity || '1');
    if (!isNaN(opacity) && opacity <= 0) return false;
    return true;
  };

  const seen = new Set();
  const traverse = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (node instanceof HTMLElement && !seen.has(node)) {
        seen.add(node);
        const tagName = node.tagName.toLowerCase();
        if (isProbablyClickable(node, tagName)) {
          const rect = node.getBoundingClientRect();
          if (isVisible(node, rect)) {
            const inputTypeRaw = tagName === 'input' ? node.getAttribute('type') || 'text' : null;
            const inputType = inputTypeRaw ? inputTypeRaw.toLowerCase() : null;
            const text = getPrimaryText(node, tagName, inputType);
            const description = buildDescription(node, tagName, text, inputType);
            node.setAttribute(clickIdAttr, String(index));
            elements.push({
              index: index,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              tag: tagName,
              inputType: inputType,
              description: description,
            });
            index += 1;
          }
        }
        if (node.shadowRoot) traverse(node.shadowRoot);
      }
      node = walker.nextNode();
    }
  };
  traverse(document);

  return {
    elements: elements,
    nextIndex: index,
    viewport: {
      width: window.innerWidth || (document.documentElement ? document.documentElement.clientWidth : null),
      height: window.innerHeight || (document.documentElement ? document.documentElement.clientHeight : null),
      devicePixelRatio: window.devicePixelRatio || 1,
    },
  };
}
"""

# Find element by click index (traverses shadow DOM + iframes).
# Adapted from Manus findElementByClickId.js.
FIND_ELEMENT_BY_INDEX_JS = """
(index) => {
  const attr = 'data-manus-id';
  const target = String(index);
  const visited = new Set();
  const MAX_DEPTH = 10;

  const walk = (root, depth) => {
    if (!root || depth > MAX_DEPTH) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (node instanceof Element && node.getAttribute(attr) === target) {
        const rect = node.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, tag: node.tagName.toLowerCase() };
      }
      if (node instanceof Element && node.shadowRoot) {
        const found = walk(node.shadowRoot, depth + 1);
        if (found) return found;
      }
      node = walker.nextNode();
    }
    return null;
  };

  const searchFrames = (doc, depth) => {
    if (!doc || depth > MAX_DEPTH) return null;
    const foundInDoc = walk(doc, depth);
    if (foundInDoc) return foundInDoc;
    const frames = doc.querySelectorAll('iframe, frame');
    for (const frame of frames) {
      if (!(frame instanceof HTMLIFrameElement || frame instanceof HTMLFrameElement)) continue;
      if (visited.has(frame)) continue;
      visited.add(frame);
      try {
        const childDoc = frame.contentDocument;
        const found = searchFrames(childDoc, depth + 1);
        if (found) return found;
      } catch (e) { continue; }
    }
    return null;
  };

  return searchFrames(document, 0);
}
"""

# Simple markdown extraction — converts page content to markdown-like text.
# Preserves headings, links, lists, and text structure.
EXTRACT_MARKDOWN_JS = """
(() => {
  const body = document.body;
  if (!body) return '';

  const walk = (node, depth) => {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.replace(/\\s+/g, ' ');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return '';

    // Skip script, style, noscript
    if (['script', 'style', 'noscript', 'svg', 'path'].includes(tag)) return '';

    let children = '';
    for (const child of node.childNodes) {
      children += walk(child, depth + 1);
    }
    children = children.trim();
    if (!children && !['img', 'br', 'hr', 'input'].includes(tag)) return '';

    switch (tag) {
      case 'h1': return '\\n# ' + children + '\\n';
      case 'h2': return '\\n## ' + children + '\\n';
      case 'h3': return '\\n### ' + children + '\\n';
      case 'h4': return '\\n#### ' + children + '\\n';
      case 'h5': return '\\n##### ' + children + '\\n';
      case 'h6': return '\\n###### ' + children + '\\n';
      case 'p': return '\\n' + children + '\\n';
      case 'br': return '\\n';
      case 'hr': return '\\n---\\n';
      case 'a': {
        const href = node.getAttribute('href') || '';
        if (href && !href.startsWith('javascript:')) {
          return '[' + children + '](' + href + ')';
        }
        return children;
      }
      case 'img': {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        return '![' + alt + '](' + src + ')';
      }
      case 'strong': case 'b': return '**' + children + '**';
      case 'em': case 'i': return '*' + children + '*';
      case 'code': return '`' + children + '`';
      case 'pre': return '\\n```\\n' + children + '\\n```\\n';
      case 'blockquote': return '\\n> ' + children.replace(/\\n/g, '\\n> ') + '\\n';
      case 'li': return '- ' + children + '\\n';
      case 'ul': case 'ol': return '\\n' + children;
      case 'table': return '\\n' + children + '\\n';
      case 'tr': return children + '\\n';
      case 'td': case 'th': return children + ' | ';
      case 'div': case 'section': case 'article': case 'main':
        return '\\n' + children + '\\n';
      default: return children;
    }
  };

  let md = walk(body, 0);
  // Clean up excessive newlines
  md = md.replace(/\\n{3,}/g, '\\n\\n').trim();
  // Truncate to 15000 chars
  return md.length > 15000 ? md.slice(0, 15000) + '\\n...(truncated)' : md;
})()
"""


# ── Screenshot annotation (Pillow) ───────────────────────────────────────────

def annotate_screenshot(screenshot_path: str, elements: list[dict]) -> str:
    """Draw numbered bounding boxes on screenshot for element indexing.

    Accepts base64-encoded PNG, returns base64-encoded annotated PNG.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        logger.warning("Pillow not installed — skipping screenshot annotation")
        return screenshot_path

    if not elements:
        return screenshot_path

    try:
        img = Image.open(io.BytesIO(base64.b64decode(screenshot_path)))
        draw = ImageDraw.Draw(img)

        # Try to load a small font, fall back to default
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 11)
        except (OSError, IOError):
            font = ImageFont.load_default()

        # Colors cycle for different elements
        colors = [
            (255, 0, 0),     # red
            (0, 128, 255),   # blue
            (0, 180, 0),     # green
            (255, 128, 0),   # orange
            (180, 0, 255),   # purple
            (0, 180, 180),   # teal
        ]

        for elem in elements:
            idx = elem.get("index", 0)
            x = elem.get("x", 0)
            y = elem.get("y", 0)
            w = elem.get("width", 0)
            h = elem.get("height", 0)

            if w <= 0 or h <= 0:
                continue

            color = colors[idx % len(colors)]

            # Draw bounding box
            draw.rectangle(
                [x, y, x + w, y + h],
                outline=color,
                width=2,
            )

            # Draw index label (small box with number)
            label = str(idx)
            label_bbox = draw.textbbox((0, 0), label, font=font)
            label_w = label_bbox[2] - label_bbox[0] + 6
            label_h = label_bbox[3] - label_bbox[1] + 4

            # Position label at top-left of bounding box
            lx = max(0, x)
            ly = max(0, y - label_h - 1)
            if ly < 0:
                ly = y  # Place inside if no room above

            draw.rectangle([lx, ly, lx + label_w, ly + label_h], fill=color)
            draw.text((lx + 3, ly + 2), label, fill=(255, 255, 255), font=font)

        # Save annotated version to disk as WebP (Manus parity)
        ts = int(time.time())
        annotated_disk_path = os.path.join(SCREENSHOTS_DIR, f"screenshot_{ts}_annotated.webp")
        img.save(annotated_disk_path, format="WEBP", quality=80)

        # Return as base64 WebP for frontend rendering
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=80)
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception as e:
        logger.warning("Screenshot annotation failed: %s", e)
        return screenshot_path


# ── Browser lifecycle ─────────────────────────────────────────────────────────

async def _get_playwright():
    """Lazy-import playwright to avoid startup cost if browser isn't used."""
    try:
        from playwright.async_api import async_playwright
        return async_playwright
    except ImportError:
        return None


async def _ensure_browser():
    """Ensure browser is connected and return the active page.

    Manus pattern: Chromium is pre-launched by start-chrome.sh with CDP on port 9222.
    We connect via CDP rather than launching a new instance.
    """
    global _browser, _context, _page, _playwright_instance

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

    # Properly close previous playwright instance if it exists
    if _playwright_instance is not None:
        try:
            await _playwright_instance.__aexit__(None, None, None)
        except Exception:
            pass
        _playwright_instance = None

    pw = await pw_factory().__aenter__()
    _playwright_instance = pw  # Store for proper cleanup

    # Connect to existing Chromium via CDP (Manus pattern — Chrome is pre-launched)
    try:
        _browser = await pw.chromium.connect_over_cdp(
            f"http://127.0.0.1:{CDP_PORT}",
            timeout=10000,
        )
        # Use existing contexts/pages if available
        contexts = _browser.contexts
        if contexts:
            _context = contexts[0]
            pages = _context.pages
            if pages:
                _page = pages[0]
                return _page
        # Create new context if none exists
        _context = await _browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        _page = await _context.new_page()
        return _page
    except Exception as e:
        logger.warning("CDP connect failed, falling back to launch: %s", e)
        # Fallback: launch new browser (for environments without pre-launched Chrome)
        _browser = await pw.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1280,720",
            ],
        )
        _context = await _browser.new_context(
            viewport={"width": 1280, "height": 720},
        )
        _page = await _context.new_page()
        return _page


# ── Screenshot + element collection ──────────────────────────────────────────

async def _take_screenshot() -> str | None:
    """Take a screenshot and return base64-encoded WebP data (Manus parity)."""
    if _page is None:
        return None
    try:
        os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
        ts = int(time.time())
        rand = random.randint(1000, 9999)
        path = os.path.join(SCREENSHOTS_DIR, f"screenshot_{ts}_{rand}.webp")
        await _page.screenshot(path=path, full_page=False, type="jpeg", quality=80)
        # Playwright doesn't support webp directly — convert via Pillow
        from PIL import Image
        img = Image.open(path)
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=80)
        webp_data = buf.getvalue()
        # Also save the webp to disk for agent file access
        with open(path, "wb") as f:
            f.write(webp_data)
        return base64.b64encode(webp_data).decode("ascii")
    except Exception as e:
        logger.warning("Screenshot failed: %s", e)
        return None


async def _collect_elements() -> dict[str, Any]:
    """Collect all clickable elements from the page with indices.

    Returns dict with 'elements' list and 'viewport' info.
    """
    if _page is None:
        return {"elements": [], "viewport": {}}
    try:
        result = await _page.evaluate(
            COLLECT_ELEMENTS_JS,
            {"startIndex": 1, "clickIdAttr": "data-manus-id"},
        )
        return result
    except Exception as e:
        logger.warning("Element collection failed: %s", e)
        return {"elements": [], "viewport": {}}


async def _find_element_by_index(index: int) -> dict[str, Any] | None:
    """Find element center coordinates by its click index.

    Returns {x, y, tag} or None.
    """
    if _page is None:
        return None
    try:
        result = await _page.evaluate(FIND_ELEMENT_BY_INDEX_JS, index)
        return result
    except Exception as e:
        logger.warning("Find element by index %d failed: %s", index, e)
        return None


async def _extract_markdown() -> str:
    """Extract page content as markdown."""
    if _page is None:
        return ""
    try:
        result = await _page.evaluate(EXTRACT_MARKDOWN_JS)
        return result or ""
    except Exception as e:
        logger.warning("Markdown extraction failed: %s", e)
        # Fallback to innerText
        try:
            text = await _page.evaluate("document.body?.innerText || ''")
            return text[:10000] if text else ""
        except Exception:
            return ""


async def _build_page_snapshot() -> dict[str, Any]:
    """Build a full page snapshot: elements, screenshot (annotated), markdown.

    This is the core function called by browser_view and browser_navigate.
    Returns Manus-parity response.
    """
    page = await _ensure_browser()
    title = await page.title()
    url = page.url

    # Collect elements, take screenshot, extract markdown in parallel
    element_data, screenshot_path, markdown = await asyncio.gather(
        _collect_elements(),
        _take_screenshot(),
        _extract_markdown(),
    )

    elements = element_data.get("elements", [])
    viewport = element_data.get("viewport", {})

    # Annotate screenshot with element indices
    annotated_path = screenshot_path
    if screenshot_path and elements:
        annotated_path = annotate_screenshot(screenshot_path, elements)

    # Build element descriptions for LLM (compact text format)
    element_descriptions = []
    for elem in elements:
        desc = elem.get("description", "")
        idx = elem.get("index", 0)
        element_descriptions.append(f"[{idx}] {desc}")

    return {
        "ok": True,
        "title": title,
        "url": url,
        "markdown": markdown[:15000],
        "elements": element_descriptions,
        "element_count": len(elements),
        "screenshot": annotated_path or screenshot_path,
        # Manus parity: return clean screenshot alongside annotated.
        # Orchestrator sends clean_screenshot to frontend (no bounding boxes).
        "clean_screenshot": screenshot_path,
        "viewport": viewport,
    }


# ── Action handlers ───────────────────────────────────────────────────────────

async def _handle_action(action: str, body: dict[str, Any]) -> dict[str, Any]:
    """Route browser action to appropriate handler."""
    global _browser, _context, _page, _playwright_instance

    if action == "navigate":
        page = await _ensure_browser()
        url = body.get("url", "")
        if not url:
            return {"error": "url is required"}
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Build full page snapshot (elements + annotated screenshot + markdown)
            return await _build_page_snapshot()
        except Exception as e:
            return {"error": str(e)}

    elif action == "view":
        try:
            return await _build_page_snapshot()
        except Exception as e:
            return {"error": str(e)}

    elif action == "click":
        page = await _ensure_browser()
        index = body.get("index")
        coord = body.get("coordinate")

        # Resolve index to coordinates if provided
        if index is not None and coord is None:
            found = await _find_element_by_index(int(index))
            if found:
                coord = [found["x"], found["y"]]
            else:
                return {"error": f"Element with index {index} not found"}

        if not coord or len(coord) < 2:
            return {"error": "coordinate [x, y] or index is required"}

        try:
            await page.mouse.click(coord[0], coord[1])
            await asyncio.sleep(0.5)
            # Return updated page state
            return await _build_page_snapshot()
        except Exception as e:
            return {"error": str(e)}

    elif action == "input":
        page = await _ensure_browser()
        text = body.get("text", "")
        press_enter = body.get("press_enter", False)
        index = body.get("index")
        coord = body.get("coordinate")

        # Resolve index to coordinates if provided
        if index is not None and coord is None:
            found = await _find_element_by_index(int(index))
            if found:
                coord = [found["x"], found["y"]]
            else:
                return {"error": f"Element with index {index} not found"}

        if coord and len(coord) >= 2:
            await page.mouse.click(coord[0], coord[1])
            await asyncio.sleep(0.2)

        try:
            # Clear existing text and type new
            await page.keyboard.press("Control+a")
            await page.keyboard.type(text)
            if press_enter:
                await page.keyboard.press("Enter")
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
            await page.mouse.move(x, y)
            await page.mouse.wheel(0, delta)
            await asyncio.sleep(0.3)
            # Return full snapshot after scroll so LLM sees new elements
            return await _build_page_snapshot()
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
        index = body.get("index")
        selector = body.get("selector", "")
        value = body.get("value", "")

        # If index is provided, resolve to a CSS selector
        if index is not None and not selector:
            found = await _find_element_by_index(int(index))
            if found:
                # Click the select element first, then use page.select_option
                coord = [found["x"], found["y"]]
                await page.mouse.click(coord[0], coord[1])
                await asyncio.sleep(0.2)
                # Try to select by option index
                try:
                    select_el = await page.evaluate(
                        FIND_ELEMENT_BY_INDEX_JS, int(index)
                    )
                    if select_el:
                        # value can be numeric index or string value — handle both
                        safe_value = str(value).replace("'", "\\'").replace('"', '\\"')
                        await page.evaluate(
                            f"""(idx) => {{
                                const el = document.querySelector('[data-manus-id="' + idx + '"]');
                                if (!el || el.tagName.toLowerCase() !== 'select') return;
                                const val = "{safe_value}";
                                // Try as numeric index first
                                const numIdx = parseInt(val, 10);
                                if (!isNaN(numIdx) && el.options[numIdx]) {{
                                    el.value = el.options[numIdx].value;
                                }} else {{
                                    // Try as option value string
                                    el.value = val;
                                }}
                                el.dispatchEvent(new Event('change'));
                            }}""",
                            str(index),
                        )
                except Exception:
                    pass
                screenshot = await _take_screenshot()
                return {"ok": True, "screenshot": screenshot}

        if not selector:
            return {"error": "selector or index is required"}
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
        if _browser:
            try:
                await _browser.close()
            except Exception:
                pass
        if _playwright_instance:
            try:
                await _playwright_instance.__aexit__(None, None, None)
            except Exception:
                pass
        _browser = None
        _context = None
        _page = None
        _playwright_instance = None
        # Navigate to URL after restart if provided (Manus parity)
        url = body.get("url")
        if url:
            page = await _ensure_browser()
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                return await _build_page_snapshot()
            except Exception as e:
                return {"ok": True, "message": "Browser restarted but navigation failed", "error": str(e)}
        return {"ok": True, "message": "Browser restarted"}

    elif action == "save_image":
        # Save an image from the page to a file on disk
        page = await _ensure_browser()
        image_url = body.get("url", "")
        save_path = body.get("path", "")
        if not image_url:
            return {"error": "url is required"}
        if not save_path:
            # Default to ~/downloads/<filename>
            from urllib.parse import urlparse
            parsed = urlparse(image_url)
            fname = os.path.basename(parsed.path) or "image.png"
            save_path = os.path.join("/home/ubuntu/downloads", fname)
        try:
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            # Use Playwright to download the image via page context
            resp = await page.request.get(image_url)
            if resp.ok:
                img_bytes = await resp.body()
                with open(save_path, "wb") as f:
                    f.write(img_bytes)
                screenshot = await _take_screenshot()
                return {"ok": True, "path": save_path, "size": len(img_bytes), "screenshot": screenshot}
            else:
                return {"error": f"Failed to download image: HTTP {resp.status}"}
        except Exception as e:
            return {"error": str(e)}

    elif action == "upload_file":
        # Upload a file to a file input element on the page
        page = await _ensure_browser()
        file_path = body.get("path", "")
        index = body.get("index")
        selector = body.get("selector", "")
        if not file_path:
            return {"error": "path (local file path) is required"}
        if not os.path.exists(file_path):
            return {"error": f"File not found: {file_path}"}
        try:
            if index is not None:
                # Find the file input by element index
                found = await _find_element_by_index(int(index))
                if found:
                    # Use set_input_files on the located element
                    el_handle = await page.evaluate_handle(
                        f'document.querySelector(\'[data-manus-id="{index}"]\')'
                    )
                    await el_handle.as_element().set_input_files(file_path)
                else:
                    return {"error": f"Element with index {index} not found"}
            elif selector:
                await page.set_input_files(selector, file_path)
            else:
                # Try to find any visible file input
                await page.set_input_files('input[type="file"]', file_path)
            await asyncio.sleep(0.5)
            screenshot = await _take_screenshot()
            return {"ok": True, "path": file_path, "screenshot": screenshot}
        except Exception as e:
            return {"error": str(e)}

    elif action == "fill_form":
        # Fill multiple form fields at once
        page = await _ensure_browser()
        fields = body.get("fields", [])
        if not fields or not isinstance(fields, list):
            return {"error": "fields (list of {index or selector, value}) is required"}
        results = []
        for field in fields:
            try:
                idx = field.get("index")
                sel = field.get("selector", "")
                val = field.get("value", "")
                if idx is not None:
                    found = await _find_element_by_index(int(idx))
                    if found:
                        await page.mouse.click(found["x"], found["y"])
                        await asyncio.sleep(0.1)
                        await page.keyboard.press("Control+a")
                        await page.keyboard.type(str(val))
                        results.append({"index": idx, "ok": True})
                    else:
                        results.append({"index": idx, "error": "Element not found"})
                elif sel:
                    await page.fill(sel, str(val))
                    results.append({"selector": sel, "ok": True})
            except Exception as e:
                results.append({"error": str(e)})
        await asyncio.sleep(0.3)
        screenshot = await _take_screenshot()
        return {"ok": True, "results": results, "screenshot": screenshot}

    elif action == "find_keyword":
        # Find and highlight a keyword on the page (Ctrl+F equivalent)
        page = await _ensure_browser()
        keyword = body.get("keyword", "")
        if not keyword:
            return {"error": "keyword is required"}
        try:
            # Use Ctrl+F to trigger browser find and type the keyword
            await page.keyboard.press("Control+f")
            await asyncio.sleep(0.3)
            await page.keyboard.type(keyword)
            await asyncio.sleep(0.5)
            # Count matches via JS
            match_count = await page.evaluate("""() => {
                // Use window.find for basic match counting
                let count = 0;
                const sel = window.getSelection();
                if (sel) sel.removeAllRanges();
                while (window.find(arguments[0] || '', false, false, true)) {
                    count++;
                    if (count > 1000) break;
                }
                if (sel) sel.removeAllRanges();
                return count;
            }""")
            screenshot = await _take_screenshot()
            # Close the find bar
            await page.keyboard.press("Escape")
            return {"ok": True, "keyword": keyword, "matches": match_count, "screenshot": screenshot}
        except Exception as e:
            return {"error": str(e)}

    elif action == "close":
        # Close the browser (destroy Playwright instance without restarting)
        if _browser:
            try:
                await _browser.close()
            except Exception:
                pass
        if _playwright_instance:
            try:
                await _playwright_instance.__aexit__(None, None, None)
            except Exception:
                pass
        _browser = None
        _context = None
        _page = None
        _playwright_instance = None
        return {"ok": True, "message": "Browser closed"}

    else:
        return {"error": f"Unknown browser action: {action}"}


# ── HTTP endpoints ────────────────────────────────────────────────────────────

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
