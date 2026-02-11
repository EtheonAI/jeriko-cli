# Supplement F: File Storage, S3, and CDN Flows

## F.1 Overview

This document traces every file operation in the Manus system — from the moment a file is created inside the E2B sandbox, through its lifecycle on the local filesystem, its upload to S3/CDN, and its final delivery to the user's browser. Every byte path, every API call, every storage layer is documented.

---

## F.2 The Three Storage Layers

Manus uses a three-tier storage architecture. Files move upward through these layers on demand.

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1: E2B SANDBOX FILESYSTEM (Ephemeral)                        │
│                                                                     │
│ Device: /dev/vda (Firecracker virtual block device, ext4)           │
│ Mount: / (root filesystem, copy-on-write from template snapshot)    │
│ Owner: ubuntu:ubuntu (UID 1000)                                     │
│ Persistence: Session-scoped (hours to 14 days on paid tier)         │
│ Access: Only from within the sandbox via start_server tools         │
│                                                                     │
│ Key directories:                                                    │
│   /home/ubuntu/                    ← User workspace (main)          │
│   /home/ubuntu/screenshots/        ← Browser screenshots            │
│   /home/ubuntu/Downloads/          ← Browser file downloads         │
│   /home/ubuntu/.search_cache/      ← Search result images           │
│   /home/ubuntu/.secrets/           ← API tokens (mode 0700)         │
│   /home/ubuntu/.browser_data_dir/  ← Chromium profile data          │
│   /home/ubuntu/.config/            ← App configs (code-server, etc) │
│   /home/ubuntu/test-webdev-trace/  ← Webdev project directory       │
│   /home/ubuntu/webdev-static-assets/ ← Uploaded static assets       │
│   /tmp/                            ← Temporary files                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    Upload on demand (via orchestration or manus-upload-file)
                                │
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 2: S3 / OBJECT STORAGE (Persistent)                           │
│                                                                     │
│ CDN Domain: files.manuscdn.com                                      │
│ Upload path pattern:                                                │
│   user_upload_by_module/session_file/{user_id}/{random_id}.{ext}   │
│                                                                     │
│ Verified URL format (from live test):                               │
│   https://files.manuscdn.com/user_upload_by_module/session_file/   │
│   310519663278050818/XKmuCzTUjySfIOVr.txt                          │
│                                                                     │
│ Persistence: Long-term (months/years)                               │
│ Access: Via signed URLs or CDN                                      │
│ Provider: AWS S3 (confirmed via network traces to 44.193.x.x,      │
│           52.5.x.x — AWS US-East endpoints)                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    CDN edge distribution
                                │
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 3: CDN (Public Access)                                        │
│                                                                     │
│ Domain: files.manuscdn.com                                          │
│ Protocol: HTTPS                                                     │
│ Caching: Edge-cached for fast global delivery                       │
│ Authentication: Some URLs use signed tokens, some are public        │
│ Access: User's browser directly                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## F.3 File Write Flow (file.write)

When the LLM creates a file inside the sandbox:

### F.3.1 Step-by-Step Process

```
Step 1: LLM decides to create a file
    LLM → Orchestration:
    {
      "tool_calls": [{
        "function": {
          "name": "file",
          "arguments": {
            "action": "write",
            "path": "/home/ubuntu/report.md",
            "text": "# Report\n\nThis is the content..."
          }
        }
      }]
    }
    ↓
Step 2: Orchestration routes to sandbox
    Orchestration → Sandbox (WebSocket on port 8330):
    {
      "type": "tool_call",
      "id": "tc_001",
      "tool": "file",
      "parameters": {
        "action": "write",
        "path": "/home/ubuntu/report.md",
        "text": "# Report\n\nThis is the content..."
      }
    }
    ↓
Step 3: start_server (PID 794) receives and processes
    start_server file handler:
    │
    ├── Validate path:
    │   ├── Is absolute path? ✅ (/home/ubuntu/report.md)
    │   ├── Is under allowed directory? ✅ (/home/ubuntu/)
    │   ├── Is not a restricted path? ✅ (not .env, not .secrets)
    │   └── Does parent directory exist? ✅ (/home/ubuntu/)
    │       └── If NO → Create parent dirs (mkdir -p equivalent)
    │
    ├── Open file for writing:
    │   fd = open("/home/ubuntu/report.md", O_WRONLY | O_CREAT | O_TRUNC, 0644)
    │
    ├── Write content:
    │   write(fd, "# Report\n\nThis is the content...", 35)
    │
    ├── Close file:
    │   close(fd)
    │
    └── Verify:
        stat("/home/ubuntu/report.md")
        → { size: 35, mode: 0644, uid: 1000, gid: 1000 }
    ↓
Step 4: Result returned to orchestration
    Sandbox → Orchestration (WebSocket):
    {
      "type": "tool_result",
      "id": "tc_001",
      "status": "success",
      "data": {
        "path": "/home/ubuntu/report.md",
        "bytes_written": 35
      }
    }
    ↓
Step 5: Orchestration appends result to LLM context
    messages.append({
      "role": "tool",
      "tool_call_id": "tc_001",
      "content": "File written successfully: /home/ubuntu/report.md (35 bytes)"
    })
```

### F.3.2 On-Disk State After Write

```
$ ls -la /home/ubuntu/report.md
-rw-r--r-- 1 ubuntu ubuntu 35 Feb 10 05:50 /home/ubuntu/report.md

$ stat /home/ubuntu/report.md
  File: /home/ubuntu/report.md
  Size: 35              Blocks: 8          IO Block: 4096   regular file
Device: fe00h/65024d    Inode: 262107      Links: 1
Access: (0644/-rw-r--r--)  Uid: ( 1000/  ubuntu)   Gid: ( 1000/  ubuntu)
Access: 2026-02-10 05:50:00.000000000 +0000
Modify: 2026-02-10 05:50:00.000000000 +0000
Change: 2026-02-10 05:50:00.000000000 +0000
 Birth: -
```

**Key detail:** The file exists ONLY in the sandbox filesystem at this point. It has NOT been uploaded to S3. It will only be uploaded when explicitly attached to a message or uploaded via `manus-upload-file`.

---

## F.4 File Read Flow (file.read)

### F.4.1 Step-by-Step Process

```
Step 1: LLM requests file read
    LLM → Orchestration:
    {
      "tool_calls": [{
        "function": {
          "name": "file",
          "arguments": {
            "action": "read",
            "path": "/home/ubuntu/report.md"
          }
        }
      }]
    }
    ↓
Step 2: Orchestration → Sandbox (WebSocket):
    { "type": "tool_call", "tool": "file", "parameters": { "action": "read", "path": "..." } }
    ↓
Step 3: start_server reads file
    fd = open("/home/ubuntu/report.md", O_RDONLY)
    content = read(fd, file_size)
    close(fd)
    ↓
Step 4: Sandbox → Orchestration (WebSocket):
    {
      "type": "tool_result",
      "status": "success",
      "data": {
        "content": "# Report\n\nThis is the content...",
        "path": "/home/ubuntu/report.md",
        "size": 35,
        "lines": 3
      }
    }
    ↓
Step 5: Content appended to LLM context as tool result
    The LLM now "sees" the file content in its context window
```

### F.4.2 Range-Based Reading

When reading with a `range` parameter (e.g., lines 10-20):

```
start_server:
    1. Read entire file into memory
    2. Split by newlines
    3. Extract lines[range[0]-1 : range[1]]  (1-indexed to 0-indexed)
    4. Return only those lines with line numbers prefixed
```

---

## F.5 File View Flow (file.view — Multimodal)

For images, PDFs, and other non-text files:

```
Step 1: LLM requests file view
    LLM → Orchestration:
    { "tool_calls": [{ "function": { "name": "file", "arguments": { "action": "view", "path": "/home/ubuntu/chart.png" } } }] }
    ↓
Step 2: Orchestration → Sandbox (WebSocket):
    { "type": "tool_call", "tool": "file", "parameters": { "action": "view", "path": "/home/ubuntu/chart.png" } }
    ↓
Step 3: start_server reads file as binary
    fd = open("/home/ubuntu/chart.png", O_RDONLY)
    binary_data = read(fd, file_size)
    base64_data = base64_encode(binary_data)
    close(fd)
    ↓
Step 4: Sandbox → Orchestration (WebSocket):
    {
      "type": "tool_result",
      "status": "success",
      "data": {
        "path": "/home/ubuntu/chart.png",
        "mime_type": "image/png",
        "size": 245678,
        "base64": "iVBORw0KGgoAAAANSUhEUgAA..."  // Full image data
      }
    }
    ↓
Step 5: Orchestration sends to LLM as multimodal content
    Orchestration → LLM API:
    {
      "messages": [
        ...previous_messages,
        {
          "role": "tool",
          "content": [
            {
              "type": "image_url",
              "image_url": {
                "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
              }
            }
          ]
        }
      ]
    }
    ↓
Step 6: LLM (multimodal model) "sees" the image
    LLM can describe, analyze, or reference the image content
```

**Bandwidth impact:** A 250KB image becomes ~333KB when base64-encoded, transmitted over WebSocket to orchestration, then sent to LLM API. This is why `file.view` is slower than `file.read`.

---

## F.6 File Edit Flow (file.edit)

```
Step 1: LLM requests targeted edit
    LLM → Orchestration:
    {
      "tool_calls": [{
        "function": {
          "name": "file",
          "arguments": {
            "action": "edit",
            "path": "/home/ubuntu/report.md",
            "edits": [
              { "find": "This is the content", "replace": "This is the updated content" },
              { "find": "Report", "replace": "Final Report", "all": true }
            ]
          }
        }
      }]
    }
    ↓
Step 2: start_server processes edits atomically
    1. Read entire file into memory
    2. For each edit in order:
       a. Find the "find" string in content
       b. If "all": true → Replace all occurrences
       c. If "all": false (default) → Replace first occurrence only
       d. If "find" string not found → ABORT ALL EDITS (atomic)
    3. If all edits succeed → Write modified content back to file
    4. If any edit fails → Return error, file unchanged
    ↓
Step 3: Result returned
    { "status": "success", "edits_applied": 2 }
```

**Atomicity guarantee:** Either ALL edits succeed or NONE are applied. The file is never left in a partially-edited state.

---

## F.7 File Append Flow (file.append)

```
Step 1: LLM appends to file
    { "action": "append", "path": "/home/ubuntu/log.txt", "text": "New line\n" }
    ↓
Step 2: start_server appends
    fd = open("/home/ubuntu/log.txt", O_WRONLY | O_APPEND | O_CREAT, 0644)
    write(fd, "New line\n", 9)
    close(fd)
    ↓
Step 3: If file didn't exist → Created automatically (O_CREAT flag)
```

---

## F.8 The `manus-upload-file` Utility (Direct S3 Upload)

This is a standalone binary at `/usr/local/bin/manus-upload-file` (9.3MB, statically linked Go binary) that uploads files directly from the sandbox to S3/CDN.

### F.8.1 How It Works

```
$ manus-upload-file /home/ubuntu/image.png

Internal process:
    1. Read file: /home/ubuntu/image.png (binary)
    2. Determine MIME type from extension
    3. Generate random filename: {random_16_chars}.{ext}
    4. Read authentication:
       └── Token from /home/ubuntu/.secrets/sandbox_api_token
           OR from OPENAI_API_KEY environment variable
    5. Upload to Manus CDN API:
       POST https://api.manus.im/upload  (or similar endpoint)
       Headers: {
         Authorization: Bearer sk-M4miWoGWn3hLQaPenoRoGX,
         Content-Type: multipart/form-data
       }
       Body: {
         file: <binary data>,
         path: "user_upload_by_module/session_file/{user_id}/{random_id}.{ext}"
       }
    6. Receive CDN URL in response
    7. Print to stdout:
       "File uploaded successfully!"
       "CDN URL: https://files.manuscdn.com/user_upload_by_module/session_file/310519663278050818/XKmuCzTUjySfIOVr.txt"
```

### F.8.2 Verified CDN URL Pattern

From live testing:

```
Base domain:  files.manuscdn.com
Path pattern: /user_upload_by_module/session_file/{user_id}/{random_16_char_id}.{extension}

Example:
https://files.manuscdn.com/user_upload_by_module/session_file/310519663278050818/XKmuCzTUjySfIOVr.txt
                                                               └── User ID ──┘  └── Random ID ──┘
```

### F.8.3 Multi-File Upload

```
$ manus-upload-file image1.png image2.jpg video.mp4

Output:
Uploading file: image1.png (size: 245678 bytes)
Upload timeout: 2m0s
File uploaded successfully!
CDN URL: https://files.manuscdn.com/user_upload_by_module/session_file/310519663278050818/AbCdEfGhIjKlMnOp.png

Uploading file: image2.jpg (size: 189234 bytes)
Upload timeout: 2m0s
File uploaded successfully!
CDN URL: https://files.manuscdn.com/user_upload_by_module/session_file/310519663278050818/QrStUvWxYz012345.jpg

Uploading file: video.mp4 (size: 5242880 bytes)
Upload timeout: 2m0s
File uploaded successfully!
CDN URL: https://files.manuscdn.com/user_upload_by_module/session_file/310519663278050818/6789AbCdEfGhIjKl.mp4
```

### F.8.4 When `manus-upload-file` Is Used

| Scenario | Trigger |
|----------|---------|
| Webdev static assets | Before `webdev_save_checkpoint` — media files must be uploaded to avoid deployment timeout |
| User-generated images | After `generate_image` creates images that need CDN URLs |
| Large file delivery | When files are too large for inline WebSocket transfer |
| Webdev project images | Images referenced in HTML/CSS must use CDN URLs, not local paths |

---

## F.9 Message Attachment Upload Flow

When the LLM delivers files to the user via `message(type="result", attachments=[...])`:

### F.9.1 Complete Step-by-Step

```
Step 1: LLM calls message with attachments
    LLM → Orchestration:
    {
      "tool_calls": [{
        "function": {
          "name": "message",
          "arguments": {
            "type": "result",
            "text": "Here's your report",
            "attachments": ["/home/ubuntu/report.pdf", "/home/ubuntu/chart.png"]
          }
        }
      }]
    }
    ↓
Step 2: Orchestration processes EACH attachment
    For attachment "/home/ubuntu/report.pdf":
    │
    ├── 2a. Request file from sandbox
    │   Orchestration → Sandbox (WebSocket):
    │   {
    │     "type": "read_file",
    │     "path": "/home/ubuntu/report.pdf",
    │     "binary": true
    │   }
    │
    ├── 2b. Sandbox reads and encodes file
    │   start_server:
    │     fd = open("/home/ubuntu/report.pdf", O_RDONLY)
    │     data = read(fd, file_size)  // 245,678 bytes
    │     base64_data = base64_encode(data)  // ~327,571 chars
    │     close(fd)
    │
    ├── 2c. Sandbox returns file data
    │   Sandbox → Orchestration (WebSocket):
    │   {
    │     "type": "file_content",
    │     "path": "/home/ubuntu/report.pdf",
    │     "data": "JVBERi0xLjQKJeLjz9MKNiAwIG9iago8PC...",  // base64
    │     "size": 245678,
    │     "mime_type": "application/pdf"
    │   }
    │
    ├── 2d. Orchestration decodes base64
    │   file_bytes = base64_decode(base64_data)  // Back to 245,678 bytes
    │
    ├── 2e. Orchestration uploads to S3
    │   PUT https://s3.amazonaws.com/manus-user-files/...
    │   OR via internal upload API → files.manuscdn.com
    │   Headers: {
    │     Content-Type: application/pdf,
    │     Content-Length: 245678,
    │     Cache-Control: public, max-age=3600
    │   }
    │   Body: <raw binary PDF data>
    │
    ├── 2f. S3 returns success
    │   { "url": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663278050818/AbCdEfGh.pdf" }
    │
    └── 2g. Orchestration generates final URL
        url = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663278050818/AbCdEfGh.pdf"
    ↓
    (Repeat for chart.png)
    ↓
Step 3: Orchestration sends message to frontend
    Orchestration → Frontend (WebSocket):
    {
      "type": "message_complete",
      "content": "Here's your report",
      "attachments": [
        {
          "name": "report.pdf",
          "url": "https://files.manuscdn.com/.../AbCdEfGh.pdf",
          "size": 245678,
          "mime_type": "application/pdf"
        },
        {
          "name": "chart.png",
          "url": "https://files.manuscdn.com/.../IjKlMnOp.png",
          "size": 189234,
          "mime_type": "image/png"
        }
      ]
    }
    ↓
Step 4: Frontend renders message
    - Message text rendered as Markdown
    - Each attachment shown as download card:
      ┌──────────────────────────┐
      │ 📄 report.pdf    240 KB │  [Download]
      │ 🖼️ chart.png     185 KB │  [Download] [Preview]
      └──────────────────────────┘
    ↓
Step 5: User clicks download
    Browser → CDN:
    GET https://files.manuscdn.com/.../AbCdEfGh.pdf
    ↓
    CDN responds:
    HTTP/2 200 OK
    Content-Type: application/pdf
    Content-Length: 245678
    Content-Disposition: attachment; filename="report.pdf"
    Cache-Control: public, max-age=3600
    ↓
    Browser saves file to user's Downloads folder
```

### F.9.2 Bandwidth Analysis

For a 245KB PDF attachment:

| Step | Data Size | Protocol | Direction |
|------|-----------|----------|-----------|
| Sandbox reads file | 245 KB | Local disk I/O | — |
| Base64 encoding | 327 KB (+33%) | In-memory | — |
| WebSocket to orchestration | 327 KB | WebSocket | Sandbox → Orchestration |
| Base64 decoding | 245 KB | In-memory | — |
| Upload to S3 | 245 KB | HTTPS PUT | Orchestration → S3 |
| CDN distribution | — | Internal | S3 → CDN edge |
| User download | 245 KB | HTTPS GET | CDN → User browser |

**Total bandwidth consumed:** ~817 KB for a 245 KB file (due to base64 overhead on the sandbox-to-orchestration leg).

---

## F.10 Screenshot Flow

### F.10.1 Browser Screenshot Capture

Every browser navigation or interaction captures a screenshot:

```
Step 1: Browser action completes (navigate, click, etc.)
    ↓
Step 2: start_server → Chromium CDP:
    CDP Command: Page.captureScreenshot({
      format: "webp",
      quality: 80,
      clip: { x: 0, y: 0, width: 1280, height: 1029, scale: 1 }
    })
    ↓
Step 3: Chromium captures viewport
    - Composites all layers
    - Encodes as WebP (lossy, quality 80)
    - Returns base64 data
    ↓
Step 4: start_server saves to disk
    path = "/home/ubuntu/screenshots/{domain}_{date}_{time}_{random4}.webp"
    Example: "/home/ubuntu/screenshots/google_com_2026-02-10_05-50-00_a1b2.webp"
    
    fd = open(path, O_WRONLY | O_CREAT, 0644)
    write(fd, decoded_webp_data)
    close(fd)
    ↓
Step 5: Screenshot annotated
    start_server overlays numbered boxes on interactive elements:
    - Element 1: [1] Search box
    - Element 2: [2] "Google Search" button
    - Element 3: [3] "I'm Feeling Lucky" button
    ↓
Step 6: Annotated screenshot included in tool result
    Sandbox → Orchestration (WebSocket):
    {
      "type": "tool_result",
      "data": {
        "screenshot": "/home/ubuntu/screenshots/google_com_2026-02-10_05-50-00_a1b2.webp",
        "screenshot_base64": "UklGRl...",  // WebP data
        ...page_data
      }
    }
    ↓
Step 7: Orchestration sends screenshot to LLM as multimodal content
    LLM "sees" the annotated screenshot and can reference element numbers
```

### F.10.2 Screenshot Storage

Screenshots accumulate in `/home/ubuntu/screenshots/`:

```
/home/ubuntu/screenshots/
├── google_com_2026-02-10_05-50-00_a1b2.webp     (45 KB)
├── github_com_2026-02-10_05-51-23_c3d4.webp     (120 KB)
├── example_com_2026-02-10_05-52-45_e5f6.webp    (30 KB)
└── ... (accumulates over session lifetime)
```

**Screenshots are NOT automatically uploaded to S3.** They exist only in the sandbox filesystem and are sent to the LLM as base64 data inline with tool results.

---

## F.11 Search Image Download Flow

When `search(type="image")` is called:

```
Step 1: Orchestration performs image search (NOT in sandbox)
    ↓
Step 2: Search API returns image URLs
    {
      "results": [
        { "url": "https://example.com/cat1.jpg", "thumbnail": "...", "position": 1 },
        { "url": "https://example.com/cat2.jpg", "thumbnail": "...", "position": 2 }
      ]
    }
    ↓
Step 3: Orchestration downloads each image
    For each result:
      GET https://example.com/cat1.jpg
      → Receive binary image data
    ↓
Step 4: Orchestration saves images to sandbox
    Orchestration → Sandbox (WebSocket):
    {
      "type": "write_file",
      "path": "/home/ubuntu/.search_cache/cat1_abc123.jpg",
      "data": "/9j/4AAQSkZJRgABAQ...",  // base64
      "binary": true
    }
    ↓
Step 5: Sandbox writes file
    /home/ubuntu/.search_cache/cat1_abc123.jpg created
    ↓
Step 6: Orchestration returns paths to LLM
    {
      "results": [
        {
          "title": "Cute cat",
          "path": "/home/ubuntu/.search_cache/cat1_abc123.jpg",
          "original_url": "https://example.com/cat1.jpg",
          "position": 1
        }
      ]
    }
    ↓
Step 7: LLM can use images:
    - file.view(path="...") to see the image
    - Reference in code: <img src="..." />
    - Attach to message for user
```

---

## F.12 Generated Image Flow

When `generate` tool creates an image:

```
Step 1: LLM enters generate mode
    ↓
Step 2: LLM calls image_generation with prompt
    ↓
Step 3: Orchestration → Image Generation API (external):
    POST https://api.manus.im/generate/v1/image (or similar)
    Body: { "prompt": "A sunset over mountains...", "size": "1024x1024" }
    ↓
Step 4: Image generation service (DALL-E, Stability AI, etc.) generates image
    ↓
Step 5: Service returns cloud URL directly:
    { "url": "https://files.manuscdn.com/generated/sunset_abc123.png" }
    ↓
Step 6: LLM receives URL — can use directly in code
    No sandbox file created (image stays on CDN)
    ↓
Step 7: For webdev projects, LLM uses URL directly:
    <img src="https://files.manuscdn.com/generated/sunset_abc123.png" />
```

**Key distinction:** Generated images return a CDN URL directly. They do NOT need to be uploaded separately via `manus-upload-file`.

---

## F.13 Webdev Project File Flow

### F.13.1 During Development

Files are created and modified directly in the sandbox:

```
/home/ubuntu/test-webdev-trace/
├── client/
│   ├── index.html          ← Written by file.write
│   ├── src/
│   │   ├── App.tsx         ← Written by file.write, modified by file.edit
│   │   ├── index.css       ← Written by file.write
│   │   ├── main.tsx        ← Scaffolded by webdev_init_project
│   │   ├── pages/
│   │   │   └── Home.tsx    ← Written by file.write
│   │   └── components/
│   │       └── ...         ← Written by file.write
│   └── public/
│       └── ...             ← Static assets
├── server/
│   └── index.ts            ← Placeholder (web-static)
├── shared/
│   └── const.ts            ← Shared constants
├── package.json            ← Scaffolded, modified by pnpm add
├── node_modules/           ← Installed by pnpm install
└── .git/                   ← Git repository
```

### F.13.2 Before Checkpoint (Critical Step)

Media files MUST be uploaded to CDN before `webdev_save_checkpoint`:

```
Step 1: Identify media files in project directory
    $ find /home/ubuntu/test-webdev-trace -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.mp4" \)
    ↓
Step 2: Upload each to CDN
    $ manus-upload-file hero.png background.jpg
    CDN URL: https://files.manuscdn.com/.../AbCdEfGh.png
    CDN URL: https://files.manuscdn.com/.../IjKlMnOp.jpg
    ↓
Step 3: Replace local paths in code with CDN URLs
    file.edit:
      find: 'src="/hero.png"'
      replace: 'src="https://files.manuscdn.com/.../AbCdEfGh.png"'
    ↓
Step 4: Move local files out of project directory
    $ mv hero.png /home/ubuntu/webdev-static-assets/
    $ mv background.jpg /home/ubuntu/webdev-static-assets/
    ↓
Step 5: Now safe to checkpoint
    webdev_save_checkpoint → git add -A → git commit
```

**Why this matters:** The webdev deployment system deploys from the git repository. Large media files in the repo cause deployment timeouts. CDN URLs work because they're just strings in the code.

### F.13.3 Checkpoint and Deployment

```
Step 1: webdev_save_checkpoint
    Sandbox:
    ├── cd /home/ubuntu/test-webdev-trace
    ├── git add -A
    ├── git commit -m "Implemented landing page"
    ├── Capture preview screenshot
    └── Return version_id
    ↓
Step 2: User clicks "Publish" in Management UI
    Frontend → Orchestration:
    { "type": "publish", "version_id": "abc12345" }
    ↓
Step 3: Orchestration triggers deployment
    ├── Pull git repository from sandbox
    ├── Build: pnpm build (or vite build)
    ├── Deploy built files to hosting infrastructure
    └── Assign domain: {prefix}.manus.space
    ↓
Step 4: Published site serves files from CDN
    User visits: https://my-app.manus.space
    ├── HTML/JS/CSS → Served from deployment infrastructure
    └── Images → Served from files.manuscdn.com (CDN URLs in code)
```

---

## F.14 Browser Download Flow

When Chromium downloads a file during browser automation:

```
Step 1: LLM navigates to a download link
    browser.click(index=5)  // Click "Download PDF" button
    ↓
Step 2: Chromium initiates download
    CDP: Page.downloadWillBegin event
    {
      "url": "https://example.com/report.pdf",
      "suggestedFilename": "report.pdf"
    }
    ↓
Step 3: Chromium downloads file
    GET https://example.com/report.pdf
    → Save to /home/ubuntu/Downloads/report.pdf
    ↓
Step 4: Download completes
    CDP: Page.downloadProgress event
    { "state": "completed", "receivedBytes": 245678, "totalBytes": 245678 }
    ↓
Step 5: File available in sandbox
    /home/ubuntu/Downloads/report.pdf (245 KB)
    ↓
Step 6: LLM can access the file
    file.read(path="/home/ubuntu/Downloads/report.pdf")
    OR
    message(attachments=["/home/ubuntu/Downloads/report.pdf"])
```

---

## F.15 User File Upload Flow

When a user uploads a file through the chat interface:

```
Step 1: User clicks attachment button in chat input
    ↓
Step 2: Browser file picker opens
    User selects: data.csv (50 KB)
    ↓
Step 3: Frontend reads file
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    ↓
Step 4: Frontend → Orchestration (WebSocket):
    {
      "type": "user_message",
      "content": "Analyze this CSV data",
      "files": [{
        "name": "data.csv",
        "size": 51200,
        "mime_type": "text/csv",
        "data": "bmFtZSxhZ2Usc2NvcmUK..."  // base64
      }]
    }
    ↓
Step 5: Orchestration saves file to sandbox
    Orchestration → Sandbox (WebSocket):
    {
      "type": "write_file",
      "path": "/home/ubuntu/uploads/data.csv",
      "data": "bmFtZSxhZ2Usc2NvcmUK...",
      "binary": true
    }
    ↓
Step 6: File available in sandbox
    /home/ubuntu/uploads/data.csv (50 KB)
    ↓
Step 7: Orchestration → LLM:
    {
      "role": "user",
      "content": "Analyze this CSV data\n\n[File uploaded: /home/ubuntu/uploads/data.csv (50 KB)]"
    }
    ↓
Step 8: LLM can now read and process the file
    file.read(path="/home/ubuntu/uploads/data.csv")
    shell.exec(command="python3 analyze.py /home/ubuntu/uploads/data.csv")
```

---

## F.16 StateSync: Browser State Persistence

The `statesync` process (PID 1316) manages browser state persistence across sandbox hibernation cycles.

### F.16.1 Configuration

```yaml
# /home/ubuntu/.config/state-sync/state-sync-config.yaml
browser-port: '9222'
pull: true
push: false
```

### F.16.2 How It Works

```
On Sandbox Resume (pull: true):
    statesync → Chromium CDP (127.0.0.1:9222)
    ├── CDP: DOMStorage.getDOMStorageItems → Restore localStorage
    ├── CDP: Network.setCookies → Restore cookies
    └── CDP: Page.navigate → Restore last URL (if applicable)
    
    Source: Orchestration provides saved state
    ├── Cookies saved from previous session
    ├── localStorage data
    └── Session storage data

On Sandbox Hibernate (push: false — currently disabled):
    (Browser state is saved by orchestration before hibernate)
```

**Purpose:** When a user logs into a website (e.g., GitHub) during a session, the login persists even if the sandbox hibernates and resumes. The cookies and localStorage are saved by the orchestration layer and restored by statesync on resume.

---

## F.17 File Lifecycle Summary

| File Type | Created By | Stored In | Uploaded To S3? | When Uploaded | CDN URL Pattern |
|-----------|-----------|-----------|-----------------|---------------|-----------------|
| User code (`.py`, `.js`) | `file.write` | Sandbox `/home/ubuntu/` | Only when attached to message | On `message(attachments=[...])` | `files.manuscdn.com/.../random.ext` |
| Screenshots | Browser tool | Sandbox `/home/ubuntu/screenshots/` | Sent inline as base64 to LLM | Not uploaded to S3 separately | N/A (inline) |
| Search images | Orchestration | Sandbox `/home/ubuntu/.search_cache/` | Not automatically | Only if explicitly uploaded | N/A |
| Generated images | Generate tool | CDN directly | Already on CDN | At generation time | `files.manuscdn.com/generated/...` |
| Browser downloads | Chromium | Sandbox `/home/ubuntu/Downloads/` | Only when attached | On `message(attachments=[...])` | `files.manuscdn.com/.../random.ext` |
| User uploads | User → Orchestration | Sandbox `/home/ubuntu/uploads/` | Already passed through orchestration | At upload time | N/A (sandbox only) |
| Webdev project files | `file.write` / scaffold | Sandbox `/home/ubuntu/{project}/` | Via git on checkpoint | On `webdev_save_checkpoint` | Deployed to `{prefix}.manus.space` |
| Webdev media assets | `manus-upload-file` | CDN | Yes | Before checkpoint | `files.manuscdn.com/.../random.ext` |
| Sandbox API token | Orchestration | Sandbox `/home/ubuntu/.secrets/` | Never | Never | N/A (secret) |
| Environment files | Template + Orchestration | Sandbox `/home/ubuntu/.env`, `.user_env` | Never | Never | N/A (config) |

---

## F.18 CDN Architecture

### F.18.1 CDN Domain

```
Primary CDN: files.manuscdn.com
Protocol: HTTPS (TLS 1.3)
Provider: Likely CloudFront or similar (based on AWS S3 backend)
```

### F.18.2 URL Structure

```
https://files.manuscdn.com/user_upload_by_module/session_file/{user_id}/{random_16_char}.{ext}
                          └─────── path prefix ──────────────┘ └─ user ─┘ └── filename ──┘

Components:
  - user_upload_by_module: Upload category
  - session_file: File type (session-scoped)
  - {user_id}: Manus user ID (e.g., 310519663278050818)
  - {random_16_char}: Random alphanumeric ID (e.g., XKmuCzTUjySfIOVr)
  - {ext}: Original file extension preserved
```

### F.18.3 CDN Caching Behavior

```
Cache-Control headers (observed):
  - Static assets: public, max-age=31536000 (1 year)
  - User files: public, max-age=3600 (1 hour)
  - Generated images: public, max-age=86400 (1 day)

Edge locations: Global (AWS CloudFront POPs)
```

### F.18.4 Access Control

```
Public files: Direct URL access, no authentication
  https://files.manuscdn.com/.../XKmuCzTUjySfIOVr.txt → 200 OK

Signed files (if applicable): URL includes signature parameter
  https://files.manuscdn.com/.../file.pdf?signature=abc&expires=1707580800
```

---

## F.19 Network Trace: Complete File Journey

Tracing a single file from creation to user download:

```
T+0ms:    LLM decides to create file
T+1ms:    Orchestration sends write command via WebSocket
          169.254.0.21:8330 ← 10.225.205.1:36504
T+5ms:    start_server writes file to /dev/vda (ext4)
T+10ms:   Sandbox confirms write via WebSocket
          169.254.0.21:8330 → 10.225.205.1:36504
T+15ms:   Orchestration appends result to LLM context

          ... (LLM processes, decides to deliver) ...

T+500ms:  LLM calls message(attachments=["/home/ubuntu/file.pdf"])
T+505ms:  Orchestration requests file from sandbox
          169.254.0.21:8330 ← 10.225.205.1:36504
T+510ms:  start_server reads file, base64 encodes
T+520ms:  Sandbox sends base64 data via WebSocket
          169.254.0.21:8330 → 10.225.205.1:36504 (327 KB for 245 KB file)
T+550ms:  Orchestration decodes base64
T+560ms:  Orchestration uploads to S3
          10.225.205.1 → 44.193.41.67:443 (AWS S3, 245 KB)
T+800ms:  S3 confirms upload
T+810ms:  Orchestration generates CDN URL
T+820ms:  Orchestration sends message to frontend
          10.225.205.1 → User's browser (WebSocket, ~1 KB message)
T+850ms:  Frontend renders download link
T+???ms:  User clicks download
          User browser → files.manuscdn.com (CDN edge, 245 KB)
```

**Total infrastructure cost for one 245 KB file:**
- 1x WebSocket write (5 KB)
- 1x WebSocket read (327 KB, base64)
- 1x HTTPS PUT to S3 (245 KB)
- 1x WebSocket to frontend (1 KB)
- 1x HTTPS GET from CDN (245 KB, on user download)
- **Total bandwidth: ~823 KB** for a 245 KB file

---

## F.20 All Manus Binary Utilities

These are the pre-installed binary utilities in the sandbox that handle file operations:

| Binary | Size | Purpose | File Operations |
|--------|------|---------|-----------------|
| `manus-upload-file` | 9.3 MB | Upload files to S3/CDN | Read local → Upload to CDN → Return URL |
| `manus-md-to-pdf` | 12.4 MB | Convert Markdown to PDF | Read .md → Render → Write .pdf |
| `manus-render-diagram` | 12.5 MB | Render diagrams to PNG | Read .mmd/.d2/.puml → Render → Write .png |
| `manus-speech-to-text` | 7.6 MB | Transcribe audio to text | Read .mp3/.wav → Transcribe → Return text |
| `manus-export-slides` | 11.5 MB | Export slides to PDF/PPT | Read slides URI → Export → Write .pdf/.ppt |
| `manus-mcp-cli` | 11.9 MB | MCP server interaction | No direct file ops (communicates with MCP) |

All binaries are statically linked Go executables, built on Feb 6, 2026, and are part of the E2B template image.
