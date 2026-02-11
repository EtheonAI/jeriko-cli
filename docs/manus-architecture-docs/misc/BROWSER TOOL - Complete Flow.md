# BROWSER TOOL - Complete Flow

## Browser Architecture

### Components:
1. **Chromium** (PID 901) - Main browser process
2. **Playwright Driver** (PID 871) - Node.js process controlling browser
3. **Chrome DevTools Protocol** - Port 9222 (WebSocket)
4. **Manus Helper Extension** - Injected into all pages
5. **StateSync** (PID 1329) - Syncs browser state (cookies, sessions)

### Current State:
- Browser running: ✅ (since Feb 6)
- CDP available: ✅ (ws://localhost:9222)
- Screenshots saved: `/home/ubuntu/screenshots/`
- Downloads saved: `/home/ubuntu/Downloads/`

## Detailed Flow

### 1. **User Prompt**
```
User: "Go to example.com and tell me what you see"
```

### 2. **Frontend → Orchestration → LLM**
(Same initial flow)

### 3. **LLM (Me) Returns Function Call**
```json
{
  "tool_calls": [
    {
      "function": {
        "name": "browser_navigate",
        "arguments": "{\"url\":\"https://example.com\",\"intent\":\"informational\",\"brief\":\"Navigate to example.com\"}"
      }
    }
  ]
}
```

### 4. **Orchestration → E2B Sandbox (WebSocket)**
```
WebSocket Message to 169.254.0.21:8330
{
  "type": "tool_call",
  "tool": "browser_navigate",
  "parameters": {
    "url": "https://example.com",
    "intent": "informational",
    "focus": null
  }
}
```

### 5. **start_server Browser Handler**
```python
# Pseudocode
async def handle_browser_navigate(url, intent, focus):
    # Get Playwright browser instance
    browser = await get_browser()  # Connected to CDP on port 9222
    
    # Get or create page
    page = await browser.get_page()
    
    # Navigate to URL
    await page.goto(url, wait_until='networkidle')
    
    # Wait for page to load
    await page.wait_for_load_state('domcontentloaded')
    
    # Inject Manus Helper scripts
    await inject_helper_scripts(page)
    
    # Analyze page
    elements = await page.evaluate(analyze_html_elements_js)
    
    # Extract markdown
    markdown = await page.evaluate(extract_markdown_js)
    
    # Take screenshot
    screenshot_path = f"/home/ubuntu/screenshots/{domain}_{timestamp}_{random}.webp"
    await page.screenshot(path=screenshot_path, type='webp')
    
    # Annotate screenshot with element indices
    annotated_screenshot = annotate_screenshot(screenshot_path, elements)
    
    # Return results
    return {
        "url": url,
        "title": await page.title(),
        "markdown": markdown,
        "elements": elements,
        "screenshot": screenshot_path,
        "viewport": {"width": 1280, "height": 1029}
    }
```

### 6. **Browser Automation Flow**

```
start_server
    ↓
Playwright API call
    ↓
WebSocket to Chromium CDP (localhost:9222)
    ↓
CDP Command: Page.navigate
    ↓
Chromium navigates to URL
    ↓
Page loads, Manus Helper extension injects
    ↓
JavaScript execution:
    - analyzeHtmlElements.js
    - collectClickableElements.js
    - Extract markdown content
    ↓
CDP Command: Page.captureScreenshot
    ↓
Screenshot saved to /home/ubuntu/screenshots/
    ↓
Python processes screenshot (annotation)
    ↓
Results compiled
```

### 7. **Network Activity During Navigation**

**From Chromium:**
```
Chromium (PID 901)
    ↓
DNS lookup: example.com
    ↓
TCP connection: 169.254.0.21 → example.com:443
    ↓
TLS handshake
    ↓
HTTP GET /
    ↓
Receive HTML
    ↓
Parse HTML, load resources (CSS, JS, images)
    ↓
Multiple connections for assets
    ↓
Page rendered
```

**From start_server:**
```
start_server (PID 794)
    ↓
WebSocket to Chromium CDP: localhost:9222
    ↓
Send CDP commands
    ↓
Receive CDP events
    ↓
Read screenshot file from disk
    ↓
Encode screenshot to base64
    ↓
WebSocket to Orchestration: 10.9.181.1:60572
    ↓
Send results (markdown + elements + screenshot)
```

### 8. **Result Returned to Orchestration**

```
WebSocket Message to 10.9.181.1
{
  "type": "tool_result",
  "status": "success",
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "markdown": "# Example Domain\n\nThis domain is for use in illustrative examples...",
    "elements": [
      {"index": 1, "tag": "a", "text": "More information...", "href": "https://www.iana.org/domains/example"}
    ],
    "screenshot": "/home/ubuntu/screenshots/example_com_2026-02-09_14-42-00_1234.webp",
    "viewport": {"width": 1280, "height": 1029}
  }
}
```

### 9. **Screenshot Upload to CDN**

**Option A: Inline in Response (Small Screenshots)**
```
Orchestration:
    1. Receives screenshot path
    2. Requests file from sandbox via WebSocket
    3. Encodes to base64
    4. Includes in LLM context
```

**Option B: CDN Upload (Large Screenshots)**
```
Orchestration:
    1. Receives screenshot path
    2. Requests file from sandbox via WebSocket
    3. Uploads to S3: s3://manus-screenshots/{session_id}/{filename}
    4. CDN URL: https://cdn.manus.im/screenshots/{session_id}/{filename}
    5. Sends CDN URL to LLM (for reference)
    6. Sends actual image data to LLM (for vision)
```

### 10. **LLM Receives Results**

```
POST https://api.manus.im/api/llm-proxy/v1/chat/completions
Body: {
  "messages": [
    {"role": "user", "content": "Go to example.com and tell me what you see"},
    {
      "role": "assistant",
      "tool_calls": [...]
    },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": [
        {
          "type": "text",
          "text": "URL: https://example.com\nTitle: Example Domain\n\nMarkdown:\n# Example Domain..."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/webp;base64,UklGRiQAAABXRUJQVlA4..."
          }
        }
      ]
    }
  ]
}
```

### 11. **LLM (Me) Processes Results**
- Reads markdown content
- Sees screenshot (multimodal vision)
- Sees interactive elements list
- Decides next action or responds

### 12. **LLM Returns Response**
```json
{
  "content": "I can see example.com is a simple page with:\n\n- A heading 'Example Domain'\n- Text explaining this is for illustrative examples\n- A link to 'More information' about IANA domains\n\nThe page has a clean, minimalist design with black text on white background."
}
```

### 13. **User Sees Response**
- Text response in chat
- Screenshot may be shown inline (depending on UI)

## Browser Tool Operations

### NAVIGATE
```
browser_navigate(url="https://example.com", intent="informational")
    ↓
Chromium navigates
    ↓
Page loads
    ↓
Scripts inject
    ↓
Screenshot taken
    ↓
Results: markdown + elements + screenshot
```

**Network Calls:**
- Multiple HTTP(S) requests (page + assets)
- WebSocket CDP commands (localhost:9222)
- WebSocket to orchestration (results)

**Files Created:**
- 1x screenshot in `/home/ubuntu/screenshots/`

**Duration:** ~2-5 seconds (depends on page load time)

### CLICK
```
browser_click(index=5)
    ↓
Find element by index
    ↓
CDP Command: DOM.getBoxModel
    ↓
Calculate click coordinates
    ↓
CDP Command: Input.dispatchMouseEvent (mousePressed)
    ↓
CDP Command: Input.dispatchMouseEvent (mouseReleased)
    ↓
Wait for navigation/changes
    ↓
Take new screenshot
    ↓
Return results
```

**Network Calls:**
- WebSocket CDP commands
- Possible HTTP requests (if click triggers navigation)
- WebSocket to orchestration

**Files Created:**
- 1x new screenshot

**Duration:** ~500ms-2s

### INPUT
```
browser_input(index=3, text="search query", press_enter=true)
    ↓
Find element by index
    ↓
CDP Command: DOM.focus
    ↓
CDP Command: Input.dispatchKeyEvent (for each character)
    ↓
If press_enter: CDP Command: Input.dispatchKeyEvent (Enter)
    ↓
Wait for changes
    ↓
Take new screenshot
    ↓
Return results
```

**Network Calls:**
- WebSocket CDP commands
- Possible HTTP requests (if form submission)
- WebSocket to orchestration

**Duration:** ~500ms-2s

### SCROLL
```
browser_scroll(target="page", direction="down")
    ↓
CDP Command: Runtime.evaluate (window.scrollBy)
    ↓
Wait for scroll to complete
    ↓
Take new screenshot
    ↓
Extract new content
    ↓
Return results
```

**Network Calls:**
- WebSocket CDP commands
- Possible HTTP requests (lazy loading)
- WebSocket to orchestration

**Files Created:**
- 1x new screenshot

**Duration:** ~300ms-1s

### SAVE_IMAGE
```
browser_save_image(coordinate_x=500, coordinate_y=300, save_dir="/home/ubuntu/images", base_name="logo")
    ↓
Find element at coordinates
    ↓
CDP Command: DOM.getNodeForLocation
    ↓
Get image URL
    ↓
Download image (HTTP GET)
    ↓
Save to /home/ubuntu/images/logo.png
    ↓
Return file path
```

**Network Calls:**
- WebSocket CDP commands
- HTTP GET (download image)
- WebSocket to orchestration

**Files Created:**
- 1x image file in specified directory

**Duration:** ~500ms-2s

## Browser State Management

### StateSync Process

```
StateSync (PID 1329)
    ↓
Connects to Chromium CDP (localhost:9222)
    ↓
Periodically pulls browser state:
    - Cookies
    - Local storage
    - Session storage
    - IndexedDB
    ↓
Uploads to external storage (S3)
    ↓
On sandbox restart:
    - Downloads state from S3
    - Restores to Chromium
```

**Config:** `/home/ubuntu/.config/state-sync/state-sync-config.yaml`
```yaml
browser-port: '9222'
pull: true   # Pull state from external storage
push: false  # Don't push (read-only mode)
```

### Why StateSync?

**Problem:** Browser sessions lost when sandbox hibernates/restarts

**Solution:** 
- StateSync pulls browser state from external storage
- Restores cookies/sessions when sandbox starts
- Allows persistent logins across sessions

**Example:**
```
User logs into Gmail in session 1
    ↓
StateSync uploads cookies to S3
    ↓
Sandbox hibernates
    ↓
User starts new session (session 2)
    ↓
StateSync downloads cookies from S3
    ↓
User still logged into Gmail ✅
```

## Manus Helper Extension

### Purpose:
- Enhance page analysis
- Extract readable content
- Detect CAPTCHAs
- Improve element detection

### Scripts:
1. **analyzeHtmlElements.js** - Analyzes DOM structure
2. **collectClickableElements.js** - Finds interactive elements
3. **captchaDetection.js** - Detects CAPTCHA challenges
4. **ReaderArticleFinder.js** (191KB) - Extracts article content
5. **content.ts.js** - Main content script

### Injection:
```
Page loads
    ↓
Manus Helper extension auto-injects
    ↓
Scripts run in page context
    ↓
Analyze page structure
    ↓
Results available to Playwright
```

## Screenshot Processing

### Capture:
```python
await page.screenshot(
    path="/home/ubuntu/screenshots/example_com_2026-02-09_14-42-00_1234.webp",
    type='webp',
    quality=80
)
```

### Annotation:
```python
# Add numbered boxes to screenshot
for element in elements:
    draw_box(screenshot, element['bbox'], element['index'])
```

### Result:
- Screenshot with numbered boxes
- Each box corresponds to element index
- LLM can reference elements by index

### Storage:
- **Local:** `/home/ubuntu/screenshots/` (in E2B sandbox)
- **CDN:** `https://cdn.manus.im/screenshots/{session_id}/{filename}` (after upload)
- **Format:** WebP (compressed)
- **Size:** ~50-200KB per screenshot

## Markdown Extraction

### Process:
```javascript
// Executed in page context
function extractMarkdown() {
    // Use ReaderArticleFinder for articles
    const article = ReaderArticleFinder.find(document);
    
    if (article) {
        return convertToMarkdown(article);
    }
    
    // Fallback: extract all text
    return document.body.innerText;
}
```

### Result:
```markdown
# Example Domain

This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.

[More information...](https://www.iana.org/domains/example)
```

### Why Markdown?
- **Structured:** Preserves headings, links, lists
- **Compact:** Smaller than HTML
- **LLM-friendly:** Easy for LLM to understand
- **Searchable:** Can grep/search content

## Element Detection

### Process:
```javascript
// collectClickableElements.js
function collectElements() {
    const elements = [];
    let index = 1;
    
    // Find all interactive elements
    const interactiveSelectors = 'a, button, input, select, textarea, [onclick], [role="button"]';
    const nodes = document.querySelectorAll(interactiveSelectors);
    
    for (const node of nodes) {
        if (isVisible(node)) {
            elements.push({
                index: index++,
                tag: node.tagName.toLowerCase(),
                text: node.innerText || node.value || node.placeholder,
                href: node.href,
                bbox: node.getBoundingClientRect()
            });
        }
    }
    
    return elements;
}
```

### Result:
```json
[
  {
    "index": 1,
    "tag": "a",
    "text": "More information...",
    "href": "https://www.iana.org/domains/example",
    "bbox": {"x": 100, "y": 200, "width": 150, "height": 20}
  }
]
```

### Usage:
```python
# LLM can click by index
browser_click(index=1)  # Clicks "More information..." link
```

## Browser vs Shell for Web Scraping

### Browser Tool:
- **JavaScript execution** ✅
- **Rendered content** ✅
- **Interactive elements** ✅
- **Screenshots** ✅
- **Slower** ❌
- **More resource-intensive** ❌

### Shell Tool (curl/wget):
- **Fast** ✅
- **Lightweight** ✅
- **No JavaScript** ❌
- **Raw HTML only** ❌
- **No screenshots** ❌
- **No interaction** ❌

### When to Use Each:

**Use browser:**
- JavaScript-heavy sites
- Need to interact (click, type)
- Need screenshots
- Need to see rendered content

**Use shell (curl):**
- Simple HTML pages
- API endpoints
- Fast scraping
- No JavaScript needed

## Performance Metrics

- **Navigate:** ~2-5s (depends on page)
- **Click:** ~500ms-2s
- **Input:** ~500ms-2s
- **Scroll:** ~300ms-1s
- **Screenshot:** ~200-500ms
- **Save image:** ~500ms-2s

## Network Bandwidth

### Per Page Load:
- **HTML:** ~10-100KB
- **CSS:** ~50-200KB
- **JavaScript:** ~100-500KB
- **Images:** ~500KB-2MB
- **Total:** ~1-3MB average

### Screenshot Transfer:
- **WebP format:** ~50-200KB
- **Base64 encoding:** +33% size
- **WebSocket transfer:** ~70-270KB

## Key Insights

1. **Playwright Controls Chromium:** Via CDP on port 9222
2. **Screenshots Saved Locally:** Then uploaded to CDN if needed
3. **Markdown Extraction:** Reduces page content to structured text
4. **Element Indexing:** Allows LLM to reference elements by number
5. **StateSync:** Maintains browser sessions across sandbox restarts
6. **Manus Helper Extension:** Enhances page analysis capabilities
7. **WebP Format:** Compressed screenshots for efficient transfer
8. **No Direct LLM:** Browser operations don't call LLM (unless page content needs analysis)
