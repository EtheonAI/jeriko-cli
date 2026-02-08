"""
Browser tools — web search, navigation, screenshots via browser-use in E2B sandbox.

browser-use is pre-installed in the E2B sandbox template. These tools generate
Python scripts that run inside the sandbox using browser-use + Playwright + Chromium.

When no sandbox is available, falls back to simple HTTP fetch.
"""

import json
import re
import textwrap
import urllib.parse

import httpx
import structlog

from ..config import settings

logger = structlog.get_logger()


async def _sandbox_code_execute(sandbox_id: str, code: str, timeout: int = 120) -> dict:
    """Execute a Python script inside the E2B sandbox."""
    async with httpx.AsyncClient(timeout=timeout + 10) as client:
        resp = await client.post(
            f"{settings.sandbox_service_url}/sandboxes/{sandbox_id}/execute",
            json={
                "code": code,
                "language": "python",
                "timeout": timeout * 1000,
            },
        )

        if resp.status_code >= 400:
            return {"error": f"Sandbox execution failed: {resp.text}"}

        raw = resp.json()
        data = raw.get("data", raw)  # Unwrap service envelope
        stdout = data.get("stdout", "")
        stderr = data.get("stderr", "")

        # Try to parse stdout as JSON (our scripts print JSON)
        if stdout.strip():
            try:
                return json.loads(stdout.strip().split("\n")[-1])
            except (json.JSONDecodeError, IndexError):
                pass

        if data.get("error"):
            return {"error": data["error"], "stderr": stderr}

        return {"output": stdout, "stderr": stderr}


async def browser_web_search(
    sandbox_id: str | None, query: str, num_results: int = 5, date_range: str | None = None
) -> dict:
    """
    Search the web. Priority:
    1. Serper API (fastest, structured results)
    2. E2B browser via Playwright controller (visual Google search with screenshot)
    3. DuckDuckGo HTML scraping (no sandbox, no API key)
    """
    # 1. Try Serper first (fastest, most reliable)
    if settings.serper_api_key:
        serper_result = await _serper_search(query, num_results, date_range)
        if serper_result.get("results"):
            return serper_result
        # Serper failed — fall through to browser or DuckDuckGo
        if not sandbox_id:
            return serper_result

    # 2. Use E2B browser (Playwright controller on port 9821) for visual Google search
    if sandbox_id:
        try:
            from .browser_interactive import browser_action

            encoded_query = urllib.parse.quote_plus(query)
            google_url = f"https://www.google.com/search?q={encoded_query}&num={num_results}"

            result = await browser_action(sandbox_id, "navigate", {"url": google_url})

            if result.get("error"):
                logger.warning("browser_search_failed", error=result["error"], query=query)
            else:
                # Parse structured results from page content
                results = _parse_google_results(result.get("content", ""), num_results)
                return {
                    "query": query,
                    "results": results,
                    "screenshot": result.get("screenshot"),
                    "url": result.get("url", google_url),
                    "title": result.get("title", ""),
                    "source": "google-browser",
                }
        except Exception as e:
            logger.warning("browser_search_error", error=str(e), query=query)

    # 3. Fallback: DuckDuckGo HTML search (no API key, no sandbox needed)
    return await _duckduckgo_search(query, num_results)


def _parse_google_results(content: str, num_results: int = 5) -> list[dict]:
    """Extract search results from Google search page text content."""
    results = []
    if not content:
        return results

    # Google search results typically appear as blocks of text.
    # Each result has a URL line, a title, and a snippet.
    # Split content into lines and look for URL patterns.
    lines = content.split("\n")
    i = 0
    while i < len(lines) and len(results) < num_results:
        line = lines[i].strip()
        # Look for lines that contain URLs (https://...)
        url_match = re.search(r'(https?://[^\s]+)', line)
        if url_match and not any(d in url_match.group(1) for d in [
            "google.com/search", "accounts.google", "support.google",
            "policies.google", "maps.google",
        ]):
            url = url_match.group(1).rstrip(".,;)")
            # Title is typically on the same or previous line
            title = line.replace(url, "").strip(" ·›-")
            if not title and i > 0:
                title = lines[i - 1].strip()
            # Snippet is typically on the next line(s)
            snippet = ""
            if i + 1 < len(lines):
                snippet = lines[i + 1].strip()
            if title or url:
                results.append({
                    "title": title[:200] if title else url,
                    "url": url,
                    "snippet": snippet[:300],
                })
        i += 1

    return results


async def browser_navigate(sandbox_id: str | None, url: str) -> dict:
    """
    Navigate to a URL and return page content.
    Uses browser-use in the E2B sandbox for full JS rendering.
    Falls back to simple HTTP fetch if no sandbox.
    """
    if not sandbox_id:
        return await _simple_http_fetch(url)

    safe_url = url.replace("\\", "\\\\").replace('"', '\\"')

    script = textwrap.dedent(f"""\
        import asyncio
        import json

        async def navigate():
            try:
                from playwright.async_api import async_playwright

                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    page = await browser.new_page()
                    await page.goto("{safe_url}", wait_until="networkidle", timeout=30000)
                    title = await page.title()
                    content = await page.evaluate("() => document.body.innerText")
                    url = page.url
                    await browser.close()

                print(json.dumps({{
                    "url": url,
                    "title": title,
                    "content": content[:10000],
                    "source": "playwright",
                }}))
            except ImportError:
                # Playwright not available, fall back to urllib
                import urllib.request
                req = urllib.request.Request(
                    "{safe_url}",
                    headers={{"User-Agent": "Mozilla/5.0"}},
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    html = resp.read().decode("utf-8", errors="replace")

                # Strip HTML tags for text content
                import re
                text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
                text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"\\s+", " ", text).strip()

                print(json.dumps({{
                    "url": "{safe_url}",
                    "title": "",
                    "content": text[:10000],
                    "source": "urllib-fallback",
                }}))
            except Exception as e:
                print(json.dumps({{"error": str(e), "url": "{safe_url}"}}))

        asyncio.run(navigate())
    """)

    return await _sandbox_code_execute(sandbox_id, script, timeout=45)


async def browser_screenshot(sandbox_id: str | None, full_page: bool = False) -> dict:
    """
    Take a screenshot of the current browser page in the sandbox.
    Returns base64-encoded image data.
    """
    if not sandbox_id:
        return {"error": "No sandbox available for browser screenshots."}

    script = textwrap.dedent(f"""\
        import asyncio
        import json
        import base64

        async def screenshot():
            try:
                from playwright.async_api import async_playwright

                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    page = await browser.new_page()
                    # Navigate to the last loaded page or localhost
                    await page.goto("http://localhost:3000", wait_until="networkidle", timeout=15000)
                    img_bytes = await page.screenshot(full_page={str(full_page)})
                    await browser.close()

                print(json.dumps({{
                    "screenshot": base64.b64encode(img_bytes).decode(),
                    "full_page": {str(full_page).lower()},
                }}))
            except Exception as e:
                print(json.dumps({{"error": str(e)}}))

        asyncio.run(screenshot())
    """)

    return await _sandbox_code_execute(sandbox_id, script, timeout=30)


async def _serper_search(query: str, num_results: int = 5, date_range: str | None = None) -> dict:
    """Primary: use Serper API directly when configured."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            payload = {"q": query, "num": num_results}
            # Map date_range to Serper tbs parameter
            if date_range and date_range != "all":
                tbs_map = {
                    "past_hour": "qdr:h",
                    "past_day": "qdr:d",
                    "past_week": "qdr:w",
                    "past_month": "qdr:m",
                    "past_year": "qdr:y",
                }
                if date_range in tbs_map:
                    payload["tbs"] = tbs_map[date_range]

            resp = await client.post(
                "https://google.serper.dev/search",
                json=payload,
                headers={
                    "X-API-KEY": settings.serper_api_key,
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code != 200:
                return {"error": f"Serper API error: {resp.status_code}", "query": query, "results": []}

            data = resp.json()
            results = [
                {
                    "title": item.get("title", ""),
                    "url": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                }
                for item in data.get("organic", [])[:num_results]
            ]
            return {
                "query": query,
                "results": results,
                "knowledge_graph": data.get("knowledgeGraph"),
                "answer_box": data.get("answerBox"),
                "source": "serper",
            }
        except Exception as e:
            return {"error": f"Search failed: {str(e)}", "query": query, "results": []}


async def _duckduckgo_search(query: str, num_results: int = 5) -> dict:
    """Fallback web search using DuckDuckGo HTML (no API key needed)."""
    url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(query)

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; Rubic/1.0)"},
                follow_redirects=True,
            )
            html = resp.text

            results = []
            for match in re.finditer(
                r'<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>(.*?)</a>',
                html,
            ):
                href, title = match.groups()
                title = re.sub(r"<[^>]+>", "", title).strip()
                if href and title and len(results) < num_results:
                    # Resolve DuckDuckGo redirect URLs
                    clean_url = href
                    if "//duckduckgo.com/l/?" in href:
                        parsed = urllib.parse.urlparse(href)
                        params = urllib.parse.parse_qs(parsed.query)
                        if "uddg" in params:
                            clean_url = urllib.parse.unquote(params["uddg"][0])
                    results.append({"title": title, "url": clean_url, "snippet": ""})

            # Try to extract snippets
            for i, match in enumerate(
                re.finditer(r'<a class="result__snippet"[^>]*>(.*?)</a>', html)
            ):
                if i >= len(results):
                    break
                snippet = re.sub(r"<[^>]+>", "", match.group(1)).strip()
                results[i]["snippet"] = snippet

            return {
                "query": query,
                "results": results,
                "source": "duckduckgo",
            }
        except Exception as e:
            logger.warning("duckduckgo_search_failed", error=str(e), query=query)
            return {"error": f"Search failed: {str(e)}", "query": query, "results": []}


async def _simple_http_fetch(url: str) -> dict:
    """Simple HTTP fetch fallback when no sandbox browser is available."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.get(url, follow_redirects=True)
            content = resp.text
            content_type = resp.headers.get("content-type", "")

            # Strip HTML tags for cleaner text content
            if "html" in content_type.lower():
                text = re.sub(r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL)
                text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
                text = re.sub(r"<[^>]+>", " ", text)
                text = re.sub(r"\s+", " ", text).strip()
                content = text

            return {
                "url": url,
                "title": "",
                "status_code": resp.status_code,
                "content_type": content_type,
                "content": content[:10000],
                "source": "http-fallback",
            }
        except Exception as e:
            return {"error": f"Failed to fetch URL: {str(e)}", "url": url}
