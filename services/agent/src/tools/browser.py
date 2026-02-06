"""
Browser tools — web search, navigation, screenshots via browser-use in E2B sandbox.

browser-use is pre-installed in the E2B sandbox template. These tools generate
Python scripts that run inside the sandbox using browser-use + Playwright + Chromium.

When no sandbox is available, falls back to simple HTTP fetch.
"""

import json
import textwrap

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

        data = resp.json()
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
    Search the web using Serper as primary (fast, stable).
    Falls back to browser-use inside the sandbox for JS-heavy pages.
    """
    if settings.serper_api_key:
        serper_result = await _serper_search(query, num_results, date_range)
        if serper_result.get("results"):
            return serper_result
        # If Serper failed or returned no results and we have a sandbox, try browser-use
        if not sandbox_id:
            return serper_result

    if not sandbox_id:
        return {
            "error": "Web search unavailable: no sandbox and no SERPER_API_KEY configured.",
            "query": query,
            "results": [],
        }

    # Escape the query for Python string embedding
    safe_query = query.replace("\\", "\\\\").replace('"', '\\"').replace("'", "\\'")

    script = textwrap.dedent(f"""\
        import asyncio
        import json

        async def search():
            try:
                from browser_use import Agent, Browser
                from langchain_anthropic import ChatAnthropic

                browser = Browser()
                agent = Agent(
                    task=(
                        "Search for: {safe_query}. "
                        "Return the top {num_results} results. "
                        "For each result, provide the title, URL, and a brief snippet."
                    ),
                    llm=ChatAnthropic(model="claude-haiku-4-5-20251001"),
                    browser=browser,
                )
                result = await agent.run()
                await browser.close()
                print(json.dumps({{
                    "query": "{safe_query}",
                    "results": str(result),
                    "source": "browser-use",
                }}))
            except ImportError:
                # browser-use not available, fall back to simple fetch
                import urllib.parse
                import urllib.request

                url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote("{safe_query}")
                req = urllib.request.Request(url, headers={{"User-Agent": "Mozilla/5.0"}})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    html = resp.read().decode("utf-8", errors="replace")

                # Extract basic results from DuckDuckGo HTML
                results = []
                import re
                for match in re.finditer(
                    r'<a rel="nofollow" class="result__a" href="([^"]*)">(.*?)</a>',
                    html,
                ):
                    href, title = match.groups()
                    title = re.sub(r"<[^>]+>", "", title)
                    if href and title and len(results) < {num_results}:
                        results.append({{"title": title.strip(), "url": href, "snippet": ""}})

                print(json.dumps({{
                    "query": "{safe_query}",
                    "results": results,
                    "source": "duckduckgo-fallback",
                }}))
            except Exception as e:
                print(json.dumps({{"error": str(e), "query": "{safe_query}", "results": []}}))

        asyncio.run(search())
    """)

    browser_result = await _sandbox_code_execute(sandbox_id, script, timeout=60)
    if isinstance(browser_result, dict) and browser_result.get("results"):
        return browser_result
    # Final fallback to Serper if browser-use failed
    if settings.serper_api_key:
        return await _serper_search(query, num_results, date_range)
    return browser_result


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


async def _simple_http_fetch(url: str) -> dict:
    """Simple HTTP fetch fallback when no sandbox browser is available."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.get(url, follow_redirects=True)
            return {
                "url": url,
                "status_code": resp.status_code,
                "content_type": resp.headers.get("content-type", ""),
                "content": resp.text[:10000],
                "source": "http-fallback",
            }
        except Exception as e:
            return {"error": f"Failed to fetch URL: {str(e)}", "url": url}
