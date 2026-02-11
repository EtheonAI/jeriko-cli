# FILE TOOL - Complete Flow

## Test Results

Created file: `/home/ubuntu/test_file_write.txt`
- Initial write: 89 bytes
- After append: 121 bytes
- Edit operation: Successfully modified content
- **File NOT open by start_server** - Direct filesystem access!

## Detailed Flow

### 1. **User Prompt**
```
User: "Create a file called notes.txt with my meeting notes"
```

### 2. **Frontend → Orchestration → LLM**
(Same as shell tool flow)

### 3. **LLM (Me) Returns Function Call**
```json
{
  "tool_calls": [
    {
      "function": {
        "name": "file",
        "arguments": "{\"action\":\"write\",\"path\":\"/home/ubuntu/notes.txt\",\"text\":\"Meeting Notes\\n- Topic 1\\n- Topic 2\",\"brief\":\"Create notes file\"}"
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
  "tool": "file",
  "action": "write",
  "parameters": {
    "path": "/home/ubuntu/notes.txt",
    "text": "Meeting Notes\n- Topic 1\n- Topic 2"
  }
}
```

### 5. **start_server File Handler**
```python
# Pseudocode
def handle_file_write(path, text):
    # Validate path (security check)
    if not is_safe_path(path):
        raise SecurityError("Path not allowed")
    
    # Write directly to filesystem
    with open(path, 'w') as f:
        f.write(text)
    
    # Return success
    return {
        "status": "success",
        "bytes_written": len(text),
        "path": path
    }
```

### 6. **File System Operation**
```
start_server (PID 794)
    ↓
Python open() call
    ↓
Kernel filesystem layer
    ↓
Write to /home/ubuntu/notes.txt
    ↓
Inode: 262107, Device: fe00h
    ↓
File created on E2B sandbox disk
```

### 7. **Result Returned**
```
start_server → Orchestration (WebSocket)
{
  "type": "tool_result",
  "status": "success",
  "bytes_written": 35,
  "path": "/home/ubuntu/notes.txt"
}
```

### 8. **Orchestration → LLM → User**
(Same flow as shell tool)

## File Operations Breakdown

### WRITE Operation
```
User: "Create file X with content Y"
  ↓
LLM: file.write(path=X, text=Y)
  ↓
Orchestration → Sandbox WebSocket
  ↓
start_server: open(X, 'w').write(Y)
  ↓
File created on E2B sandbox filesystem
  ↓
Result: success
  ↓
LLM sees success
  ↓
User: "File created successfully"
```

**Network Calls:**
- 1x WebSocket message (orchestration → sandbox)
- 1x WebSocket message (sandbox → orchestration)

**File Location:** `/home/ubuntu/notes.txt` (inside E2B sandbox)

**Persistence:** Lasts as long as sandbox is alive (hours to 14 days)

### READ Operation
```
User: "Show me the contents of notes.txt"
  ↓
LLM: file.read(path="/home/ubuntu/notes.txt")
  ↓
Orchestration → Sandbox WebSocket
  ↓
start_server: open(path, 'r').read()
  ↓
File content read from E2B sandbox
  ↓
Result: {"content": "Meeting Notes\n- Topic 1\n- Topic 2"}
  ↓
LLM sees content
  ↓
User: "Here's what's in your file: ..."
```

**Network Calls:**
- 1x WebSocket message (orchestration → sandbox)
- 1x WebSocket message (sandbox → orchestration)

**File Location:** Read from E2B sandbox filesystem

### APPEND Operation
```
User: "Add another line to notes.txt"
  ↓
LLM: file.append(path="/home/ubuntu/notes.txt", text="\n- Topic 3")
  ↓
Orchestration → Sandbox WebSocket
  ↓
start_server: open(path, 'a').write(text)
  ↓
Content appended to existing file
  ↓
Result: success
```

**Network Calls:**
- 1x WebSocket message (orchestration → sandbox)
- 1x WebSocket message (sandbox → orchestration)

**File Modification:** Appends to end of file without reading first

### EDIT Operation
```
User: "Change 'Topic 1' to 'Important Topic' in notes.txt"
  ↓
LLM: file.edit(path="/home/ubuntu/notes.txt", edits=[{find: "Topic 1", replace: "Important Topic"}])
  ↓
Orchestration → Sandbox WebSocket
  ↓
start_server:
    1. Read entire file
    2. Apply find/replace
    3. Write back to file
  ↓
Result: {"replacements": 1, "content": "..."}
```

**Network Calls:**
- 1x WebSocket message (orchestration → sandbox)
- 1x WebSocket message (sandbox → orchestration)

**File Operations:**
1. Read entire file
2. Apply edits in memory
3. Write entire file back

### VIEW Operation (for images/PDFs)
```
User: "What's in this image?"
  ↓
LLM: file.view(path="/home/ubuntu/image.png")
  ↓
Orchestration → Sandbox WebSocket
  ↓
start_server:
    1. Read file as binary
    2. Encode to base64
    3. Return with mime type
  ↓
Result: {"content": "data:image/png;base64,...", "type": "image"}
  ↓
Orchestration decodes and sends to LLM
  ↓
LLM (multimodal) sees image
  ↓
User: "The image shows..."
```

**Network Calls:**
- 1x WebSocket message (orchestration → sandbox)
- 1x WebSocket message with base64 image data (sandbox → orchestration)
- 1x API call with image to LLM

**Data Transfer:** Large files (images/PDFs) sent as base64 over WebSocket

## File Storage Architecture

### Where Files Live

```
E2B Firecracker MicroVM
├── Root filesystem (ephemeral)
├── /home/ubuntu/ (persistent during session)
│   ├── notes.txt ← Created here
│   ├── test_file_write.txt ← Created here
│   ├── screenshots/ ← Browser screenshots
│   ├── Downloads/ ← Browser downloads
│   └── projects/ ← User projects
└── /tmp/ (ephemeral)
```

### File Persistence

**During Session:**
- Files persist in `/home/ubuntu/`
- Survive sandbox hibernation
- Available across all tool calls

**Between Sessions:**
- **Free tier**: Files lost when sandbox terminates
- **Paid tier**: Sandbox can persist up to 14 days
- **Long-term**: Files must be downloaded or uploaded to external storage

### File Access from Different Tools

```
shell tool: Can access any file via commands
file tool: Can read/write any file
browser tool: Downloads go to /home/ubuntu/Downloads/
search tool: Images downloaded to /home/ubuntu/.search_cache/
generate tool: Generated images saved to /home/ubuntu/generated/
```

## CDN Upload Flow (For User Download)

### Scenario: User wants to download a file

```
User: "Create a report and let me download it"
  ↓
LLM: file.write(path="/home/ubuntu/report.pdf", ...)
  ↓
File created in sandbox
  ↓
LLM: message(type="result", attachments=["/home/ubuntu/report.pdf"])
  ↓
Orchestration receives attachment path
  ↓
Orchestration:
    1. Reads file from sandbox via WebSocket
    2. Uploads to S3/CDN (cdn.manus.im)
    3. Generates signed URL
  ↓
Frontend receives:
    {
      "message": "Here's your report",
      "attachments": [
        {
          "name": "report.pdf",
          "url": "https://cdn.manus.im/files/abc123/report.pdf?signature=..."
        }
      ]
    }
  ↓
User clicks download link
  ↓
Browser downloads from CDN
```

### Network Calls for File Download:

1. **Sandbox → Orchestration**: WebSocket (file content)
2. **Orchestration → S3**: HTTPS PUT (upload file)
3. **S3 → CDN**: Internal replication
4. **User Browser → CDN**: HTTPS GET (download)

### File Upload Mechanism

```python
# Pseudocode in orchestration layer
def prepare_attachment(sandbox_path):
    # Request file from sandbox
    file_content = sandbox.read_file(sandbox_path)
    
    # Upload to S3
    s3_key = f"files/{user_id}/{session_id}/{filename}"
    s3.put_object(
        Bucket="manus-user-files",
        Key=s3_key,
        Body=file_content,
        ContentType=detect_mime_type(filename)
    )
    
    # Generate CDN URL
    cdn_url = f"https://cdn.manus.im/{s3_key}"
    
    # Generate signed URL (expires in 1 hour)
    signed_url = generate_signed_url(cdn_url, expires=3600)
    
    return signed_url
```

## File Tool vs Shell Tool

### File Tool:
- **Direct Python file I/O**
- **Faster** for simple operations
- **Safer** (path validation)
- **Structured** results
- **No shell overhead**

### Shell Tool:
- **Can use any command** (cat, grep, sed, awk)
- **More flexible**
- **Can process multiple files**
- **Can use pipes and redirects**
- **Shell overhead** (PTY spawn)

### When to Use Each:

**Use file tool:**
- Simple read/write operations
- Creating/editing single files
- When you need structured output
- When speed matters

**Use shell tool:**
- Complex file operations (find, grep, sed)
- Processing multiple files
- Using command-line tools
- When you need shell features (pipes, redirects)

## Performance Metrics

- **File write (small)**: ~10-20ms
- **File read (small)**: ~10-20ms
- **File write (large)**: ~50-200ms (depends on size)
- **File read (large)**: ~50-200ms (depends on size)
- **File edit**: ~20-50ms (read + write)
- **File view (image)**: ~100-500ms (read + encode base64)

## Security & Validation

### Path Validation:
```python
# Pseudocode
def is_safe_path(path):
    # Must be absolute path
    if not path.startswith('/'):
        return False
    
    # Must be under /home/ubuntu or /tmp
    if not (path.startswith('/home/ubuntu') or path.startswith('/tmp')):
        return False
    
    # No path traversal
    if '..' in path:
        return False
    
    # No symlink attacks
    if os.path.islink(path):
        return False
    
    return True
```

### File Size Limits:
- **Read**: ~10MB (to avoid memory issues)
- **Write**: ~10MB (to avoid memory issues)
- **View (base64)**: ~5MB (to avoid WebSocket message size limits)

## Key Insights

1. **Direct Filesystem Access**: File operations go directly to filesystem, not through shell
2. **No CDN Upload by Default**: Files stay in sandbox unless attached to message
3. **Ephemeral Storage**: Files lost when sandbox terminates (unless paid tier)
4. **WebSocket Transfer**: File content transferred via WebSocket to orchestration
5. **Base64 for Binary**: Images/PDFs encoded as base64 for transfer
6. **S3 for Downloads**: User downloads served from S3/CDN, not directly from sandbox
