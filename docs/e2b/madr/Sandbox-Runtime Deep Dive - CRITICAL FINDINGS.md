# Sandbox-Runtime Deep Dive - CRITICAL FINDINGS

## 1. The sandbox-runtime is a COMPILED Python application (Nuitka)

- Located at: `/opt/.manus/.sandbox-runtime/start_server` (ELF binary)
- Compiled with **Nuitka** (Python-to-C compiler)
- Original source: `sandbox_runtime.start_server.main`
- The source code is NOT available as .py files — it's compiled into the binary

## 2. Key Python packages in the sandbox-runtime venv:

- **playwright** — Browser automation (Chromium control)
- **fastapi** + **starlette** + **uvicorn** — Web server framework
- **anthropic** — LLM API client (for internal processing?)
- **langchain** + **langchain_anthropic** + **langchain_openai** — LLM orchestration
- **httpx** + **httpx_sse** + **httpx_ws** — HTTP/SSE/WebSocket clients
- **boto3** / **s3transfer** — AWS S3 for file uploads/screenshots
- **weasyprint** + **cairosvg** — PDF/SVG generation
- **pdfminer** + **pdfplumber** + **pdf2image** — PDF processing
- **openpyxl** + **xlrd** + **xlsxwriter** — Excel file handling
- **opencv (cv2)** — Image processing
- **trafilatura** + **main_content_extractor** — Web content extraction
- **pptx** — PowerPoint generation
- **websockets** — WebSocket support
- **pexpect** + **ptyprocess** — Terminal/PTY management
- **psutil** — Process management

## 3. Architecture Confirmed:

The sandbox-runtime is a **FastAPI application** that:
1. Uses **Playwright** to control the Chromium browser
2. Uses **pexpect/ptyprocess** for terminal management
3. Uses **boto3** for S3 uploads (screenshots, files)
4. Uses **trafilatura** for web content extraction
5. Uses **weasyprint** for PDF generation
6. Runs on port 8330

## 4. The Manus backend (agent server) does NOT use E2B SDK directly

The flow is:
1. E2B creates the VM/sandbox
2. The sandbox-runtime starts inside the VM
3. The Manus backend makes HTTP calls to sandbox-runtime (port 8330)
4. sandbox-runtime uses Playwright, pexpect, etc. to execute tools
5. Results (including screenshots) are returned via HTTP

## 5. For the user's project:

They have TWO options:
1. **Use E2B Desktop SDK directly** (simpler, like E2B Surf)
   - `sandbox.stream.getUrl()` for live streaming (noVNC iframe)
   - Direct SDK calls for file/terminal/browser operations
   
2. **Build their own sandbox-runtime** (complex, like Manus)
   - FastAPI service inside the E2B sandbox
   - Playwright for browser, pexpect for terminal
   - HTTP API for the agent backend to call
   - Neko for WebRTC streaming

The user's current code tries to call a sandbox-runtime-like service at localhost:4012
but that service doesn't exist. They need to either:
- Replace those HTTP calls with direct E2B SDK calls (Option 1)
- Build the sandbox-runtime service (Option 2)
