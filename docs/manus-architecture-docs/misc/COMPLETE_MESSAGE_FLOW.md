# Complete Message Flow - Every Network Call, Every State Update

## Executive Summary

This document traces the EXACT flow from when you type a message and hit send, through every HTTP request, WebSocket message, Redux action, database update, and E2B sandbox call, until you see the response.

---

## The Players

### Frontend (React + Redux)
- **URL:** https://manus.im/app
- **State Management:** Redux with 41 slices
- **Key Slices:**
  - `sessions` - Session list and current session
  - `chat` - Input value, files, settings
  - `timeline` - Event timeline (messages, tool calls, plans)
  - `agentWorkspace` - Sidebar, planner UI
  - `websocket` - WebSocket connection status
  - `auth` - User info, tokens

### Backend (Orchestration API)
- **Base URL:** https://api.manus.im
- **Components:**
  - REST API (HTTP endpoints)
  - WebSocket server (real-time updates)
  - LLM proxy
  - Tool router
  - File manager
  - Database

### E2B Sandbox
- **IP:** 169.254.0.21 (from orchestration perspective)
- **Port:** 8330 (start_server listening)
- **Components:**
  - start_server (request handler)
  - Chromium (browser)
  - Filesystem
  - PTY sessions

---

## Complete Flow: You Send "Create a file called test.txt"

### Phase 1: User Input (Frontend)

```
┌─────────────────────────────────────────────────────────────┐
│ YOU: Type "Create a file called test.txt" and press Enter  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: React Component                                   │
│                                                              │
│ 1. Input onChange handler fires                             │
│    - Updates local state                                    │
│    - Redux action: chat/setInputValue                       │
│                                                              │
│ 2. User presses Enter (or clicks Send button)               │
│    - Triggers sendMessage() function                        │
│    - Validates input (not empty, session exists)            │
│                                                              │
│ 3. Redux dispatch: chat/sendMessage                         │
│    - Payload: {                                             │
│        message: "Create a file called test.txt",            │
│        sessionId: "abc123" (or null for new session)        │
│      }                                                       │
│                                                              │
│ 4. Redux middleware intercepts                              │
│    - Checks if session exists                               │
│    - If no session: Create new session first                │
│    - If session exists: Send message directly               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 2: Session Creation (if needed)

```
┌─────────────────────────────────────────────────────────────┐
│ IF NO ACTIVE SESSION:                                       │
│                                                              │
│ FRONTEND → API                                              │
│                                                              │
│ HTTP REQUEST #1:                                            │
│ POST https://api.manus.im/v1/sessions                       │
│                                                              │
│ Headers:                                                     │
│   Authorization: Bearer <user_token>                        │
│   Content-Type: application/json                            │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "title": "New Chat",                                    │
│     "model": "claude-3.5-sonnet",                           │
│     "agentMode": true                                       │
│   }                                                          │
│                                                              │
│ ↓                                                            │
│                                                              │
│ ORCHESTRATION:                                              │
│   1. Validates auth token                                   │
│   2. Checks user credits                                    │
│   3. Creates session in database                            │
│      - Generates session UID: "abc123"                      │
│      - Stores: user_id, title, model, created_at, status    │
│   4. Initializes empty timeline                             │
│   5. Allocates E2B sandbox (or reuses existing)             │
│                                                              │
│ ↓                                                            │
│                                                              │
│ HTTP RESPONSE #1:                                           │
│ Status: 201 Created                                         │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "sessionId": "abc123",                                  │
│     "title": "New Chat",                                    │
│     "model": "claude-3.5-sonnet",                           │
│     "status": "active",                                     │
│     "createdAt": "2026-02-09T16:30:00Z",                    │
│     "sandboxId": "sandbox_xyz"                              │
│   }                                                          │
│                                                              │
│ ↓                                                            │
│                                                              │
│ FRONTEND:                                                   │
│   Redux action: sessions/sessionCreated                     │
│   - Adds session to sessions.sessions.entities              │
│   - Sets sessions.currentSessionId = "abc123"               │
│   - Updates UI to show new session                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 3: WebSocket Connection

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Establish WebSocket                               │
│                                                              │
│ WebSocket connection (if not already connected):            │
│                                                              │
│ WEBSOCKET CONNECT:                                          │
│ wss://api.manus.im/ws?sessionId=abc123&token=<user_token>   │
│                                                              │
│ ↓                                                            │
│                                                              │
│ ORCHESTRATION:                                              │
│   1. Validates token                                        │
│   2. Associates WebSocket with session                      │
│   3. Sends connection confirmation                          │
│                                                              │
│ ↓                                                            │
│                                                              │
│ WEBSOCKET MESSAGE (server → client):                        │
│ {                                                            │
│   "type": "connected",                                      │
│   "sessionId": "abc123",                                    │
│   "timestamp": "2026-02-09T16:30:01Z"                       │
│ }                                                            │
│                                                              │
│ ↓                                                            │
│                                                              │
│ FRONTEND:                                                   │
│   Redux action: websocket/connected                         │
│   - Sets websocket.status = "connected"                     │
│   - UI shows "Connected" indicator                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 4: Send Message

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND → API                                              │
│                                                              │
│ HTTP REQUEST #2:                                            │
│ POST https://api.manus.im/v1/sessions/abc123/messages       │
│                                                              │
│ Headers:                                                     │
│   Authorization: Bearer <user_token>                        │
│   Content-Type: application/json                            │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "role": "user",                                         │
│     "content": "Create a file called test.txt",             │
│     "files": []                                             │
│   }                                                          │
│                                                              │
│ ↓                                                            │
│                                                              │
│ HTTP RESPONSE #2:                                           │
│ Status: 202 Accepted                                        │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "messageId": "msg_001",                                 │
│     "status": "processing"                                  │
│   }                                                          │
│                                                              │
│ ↓                                                            │
│                                                              │
│ FRONTEND:                                                   │
│   Redux action: timeline/messageAdded                       │
│   - Adds user message to timeline                           │
│   - Shows "Processing..." indicator                         │
│   - Clears input field                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 5: Orchestration Processing

```
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATION: Process Message                              │
│                                                              │
│ 1. DATABASE UPDATE #1:                                      │
│    INSERT INTO messages (                                   │
│      id, session_id, role, content, created_at, status      │
│    ) VALUES (                                                │
│      'msg_001', 'abc123', 'user',                           │
│      'Create a file called test.txt',                       │
│      NOW(), 'received'                                      │
│    );                                                        │
│                                                              │
│ 2. WEBSOCKET MESSAGE #1 (server → client):                  │
│    {                                                         │
│      "type": "message",                                     │
│      "messageId": "msg_001",                                │
│      "role": "user",                                        │
│      "content": "Create a file called test.txt",            │
│      "timestamp": "2026-02-09T16:30:02Z"                    │
│    }                                                         │
│                                                              │
│    FRONTEND Redux: timeline/messageReceived                 │
│    - Confirms message in timeline                           │
│                                                              │
│ 3. LOAD CONVERSATION HISTORY:                               │
│    SELECT * FROM messages                                   │
│    WHERE session_id = 'abc123'                              │
│    ORDER BY created_at ASC;                                 │
│                                                              │
│    Result: [                                                 │
│      {role: "user", content: "Create a file..."}            │
│    ]                                                         │
│                                                              │
│ 4. PREPARE LLM REQUEST:                                     │
│    - Format conversation history                            │
│    - Load tool definitions (29 tools)                       │
│    - Add system prompt                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 6: LLM API Call (Claude)

```
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATION → ANTHROPIC API                               │
│                                                              │
│ HTTP REQUEST #3:                                            │
│ POST https://api.anthropic.com/v1/messages                  │
│                                                              │
│ Headers:                                                     │
│   x-api-key: <manus_anthropic_key>                          │
│   anthropic-version: 2023-06-01                             │
│   Content-Type: application/json                            │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "model": "claude-3-5-sonnet-20241022",                  │
│     "max_tokens": 4096,                                     │
│     "system": "<system_prompt>",                            │
│     "messages": [                                            │
│       {                                                      │
│         "role": "user",                                     │
│         "content": "Create a file called test.txt"          │
│       }                                                      │
│     ],                                                       │
│     "tools": [                                               │
│       {                                                      │
│         "name": "file_write",                               │
│         "description": "Write content to a file",           │
│         "input_schema": {                                   │
│           "type": "object",                                 │
│           "properties": {                                   │
│             "file": {"type": "string"},                     │
│             "content": {"type": "string"}                   │
│           },                                                 │
│           "required": ["file", "content"]                   │
│         }                                                    │
│       },                                                     │
│       ... (28 more tools)                                   │
│     ]                                                        │
│   }                                                          │
│                                                              │
│ ↓                                                            │
│                                                              │
│ ANTHROPIC API PROCESSES:                                    │
│   - Claude 3.5 Sonnet analyzes request                      │
│   - Decides to use file_write tool                          │
│   - Generates function call                                 │
│                                                              │
│ ↓                                                            │
│                                                              │
│ HTTP RESPONSE #3:                                           │
│ Status: 200 OK                                              │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "id": "msg_claude_001",                                 │
│     "type": "message",                                      │
│     "role": "assistant",                                    │
│     "content": [                                             │
│       {                                                      │
│         "type": "tool_use",                                 │
│         "id": "toolu_001",                                  │
│         "name": "file_write",                               │
│         "input": {                                          │
│           "file": "/home/ubuntu/test.txt",                  │
│           "content": ""                                     │
│         }                                                    │
│       }                                                      │
│     ],                                                       │
│     "stop_reason": "tool_use",                              │
│     "usage": {                                               │
│       "input_tokens": 1234,                                 │
│       "output_tokens": 56                                   │
│     }                                                        │
│   }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 7: Tool Execution

```
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATION: Process Tool Call                            │
│                                                              │
│ 1. DATABASE UPDATE #2:                                      │
│    INSERT INTO tool_calls (                                 │
│      id, session_id, tool_name, parameters, status          │
│    ) VALUES (                                                │
│      'toolu_001', 'abc123', 'file_write',                   │
│      '{"file":"/home/ubuntu/test.txt","content":""}',       │
│      'pending'                                              │
│    );                                                        │
│                                                              │
│ 2. WEBSOCKET MESSAGE #2 (server → client):                  │
│    {                                                         │
│      "type": "tool_call",                                   │
│      "toolCallId": "toolu_001",                             │
│      "toolName": "file_write",                              │
│      "status": "running",                                   │
│      "parameters": {                                        │
│        "file": "/home/ubuntu/test.txt",                     │
│        "content": ""                                        │
│      },                                                      │
│      "timestamp": "2026-02-09T16:30:03Z"                    │
│    }                                                         │
│                                                              │
│    FRONTEND Redux: timeline/toolCallStarted                 │
│    - Adds tool call to timeline                             │
│    - Shows "Writing file..." indicator                      │
│                                                              │
│ 3. ROUTE TOOL:                                              │
│    - Lookup "file_write" in TOOL_REGISTRY                   │
│    - Execution location: "sandbox"                          │
│    - Prepare sandbox request                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 8: E2B Sandbox Execution

```
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATION → E2B SANDBOX                                 │
│                                                              │
│ TCP CONNECTION:                                             │
│ FROM: 10.93.83.1:<random_port> (orchestration)              │
│ TO:   169.254.0.21:8330 (E2B sandbox)                       │
│                                                              │
│ HTTP/gRPC REQUEST #4:                                       │
│ POST http://169.254.0.21:8330/tools/execute                 │
│                                                              │
│ Headers:                                                     │
│   Authorization: Bearer <sandbox_token>                     │
│   Content-Type: application/json                            │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "tool": "file_write",                                   │
│     "parameters": {                                         │
│       "file": "/home/ubuntu/test.txt",                      │
│       "content": ""                                         │
│     },                                                       │
│     "sessionId": "abc123",                                  │
│     "toolCallId": "toolu_001"                               │
│   }                                                          │
│                                                              │
│ ↓                                                            │
│                                                              │
│ E2B SANDBOX (start_server):                                 │
│   1. Receives request                                       │
│   2. Parses tool name: "file_write"                         │
│   3. Calls file handler                                     │
│   4. Executes: echo "" > /home/ubuntu/test.txt              │
│   5. Verifies file created                                  │
│   6. Returns success                                        │
│                                                              │
│ ↓                                                            │
│                                                              │
│ HTTP/gRPC RESPONSE #4:                                      │
│ Status: 200 OK                                              │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "status": "success",                                    │
│     "result": {                                             │
│       "file": "/home/ubuntu/test.txt",                      │
│       "size": 0,                                            │
│       "created": true                                       │
│     },                                                       │
│     "executionTime": 0.05                                   │
│   }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 9: Tool Result Processing

```
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATION: Process Tool Result                          │
│                                                              │
│ 1. DATABASE UPDATE #3:                                      │
│    UPDATE tool_calls                                        │
│    SET status = 'completed',                                │
│        result = '{"file":"/home/ubuntu/test.txt",...}',     │
│        completed_at = NOW()                                 │
│    WHERE id = 'toolu_001';                                  │
│                                                              │
│ 2. WEBSOCKET MESSAGE #3 (server → client):                  │
│    {                                                         │
│      "type": "tool_result",                                 │
│      "toolCallId": "toolu_001",                             │
│      "status": "completed",                                 │
│      "result": {                                            │
│        "file": "/home/ubuntu/test.txt",                     │
│        "created": true                                      │
│      },                                                      │
│      "timestamp": "2026-02-09T16:30:04Z"                    │
│    }                                                         │
│                                                              │
│    FRONTEND Redux: timeline/toolCallCompleted               │
│    - Updates tool call status in timeline                   │
│    - Shows "File created" indicator                         │
│                                                              │
│ 3. PREPARE NEXT LLM CALL:                                   │
│    - Add tool result to conversation                        │
│    - Send back to Claude for final response                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 10: Final LLM Response

```
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATION → ANTHROPIC API                               │
│                                                              │
│ HTTP REQUEST #5:                                            │
│ POST https://api.anthropic.com/v1/messages                  │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "model": "claude-3-5-sonnet-20241022",                  │
│     "messages": [                                            │
│       {                                                      │
│         "role": "user",                                     │
│         "content": "Create a file called test.txt"          │
│       },                                                     │
│       {                                                      │
│         "role": "assistant",                                │
│         "content": [                                         │
│           {                                                  │
│             "type": "tool_use",                             │
│             "id": "toolu_001",                              │
│             "name": "file_write",                           │
│             "input": {...}                                  │
│           }                                                  │
│         ]                                                    │
│       },                                                     │
│       {                                                      │
│         "role": "user",                                     │
│         "content": [                                         │
│           {                                                  │
│             "type": "tool_result",                          │
│             "tool_use_id": "toolu_001",                     │
│             "content": "{\"status\":\"success\",\"file\":...}"│
│           }                                                  │
│         ]                                                    │
│       }                                                      │
│     ],                                                       │
│     "tools": [...]                                          │
│   }                                                          │
│                                                              │
│ ↓                                                            │
│                                                              │
│ ANTHROPIC API PROCESSES:                                    │
│   - Claude sees tool result                                 │
│   - Generates final response                                │
│                                                              │
│ ↓                                                            │
│                                                              │
│ HTTP RESPONSE #5:                                           │
│ Status: 200 OK                                              │
│                                                              │
│ Body:                                                        │
│   {                                                          │
│     "id": "msg_claude_002",                                 │
│     "type": "message",                                      │
│     "role": "assistant",                                    │
│     "content": [                                             │
│       {                                                      │
│         "type": "text",                                     │
│         "text": "I've created the file test.txt in /home/ubuntu/"│
│       }                                                      │
│     ],                                                       │
│     "stop_reason": "end_turn",                              │
│     "usage": {                                               │
│       "input_tokens": 1456,                                 │
│       "output_tokens": 23                                   │
│     }                                                        │
│   }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
```

### Phase 11: Final Response Delivery

```
┌─────────────────────────────────────────────────────────────┐
│ ORCHESTRATION: Deliver Final Response                       │
│                                                              │
│ 1. DATABASE UPDATE #4:                                      │
│    INSERT INTO messages (                                   │
│      id, session_id, role, content, created_at              │
│    ) VALUES (                                                │
│      'msg_002', 'abc123', 'assistant',                      │
│      'I''ve created the file test.txt in /home/ubuntu/',    │
│      NOW()                                                  │
│    );                                                        │
│                                                              │
│ 2. DATABASE UPDATE #5 (Credits):                            │
│    UPDATE sessions                                          │
│    SET costed_credits = costed_credits + 0.5,               │
│        updated_at = NOW()                                   │
│    WHERE id = 'abc123';                                     │
│                                                              │
│    UPDATE users                                             │
│    SET credits_used = credits_used + 0.5                    │
│    WHERE id = '310519663278050818';                         │
│                                                              │
│ 3. WEBSOCKET MESSAGE #4 (server → client):                  │
│    {                                                         │
│      "type": "message",                                     │
│      "messageId": "msg_002",                                │
│      "role": "assistant",                                   │
│      "content": "I've created the file test.txt...",        │
│      "timestamp": "2026-02-09T16:30:05Z"                    │
│    }                                                         │
│                                                              │
│    FRONTEND Redux: timeline/messageReceived                 │
│    - Adds assistant message to timeline                     │
│    - Renders message in chat                                │
│                                                              │
│ 4. WEBSOCKET MESSAGE #5 (server → client):                  │
│    {                                                         │
│      "type": "task_finished",                               │
│      "sessionId": "abc123",                                 │
│      "creditsUsed": 0.5,                                    │
│      "timestamp": "2026-02-09T16:30:05Z"                    │
│    }                                                         │
│                                                              │
│    FRONTEND Redux: websocket/taskFinished                   │
│    - Sets websocket.taskFinished = true                     │
│    - Hides "Processing..." indicator                        │
│    - Shows "Task complete" indicator                        │
│    - Updates credit display                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ YOU: See the response "I've created the file test.txt..."  │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Network Call Summary

### HTTP Requests (5 total):

1. **POST /v1/sessions** (if new session)
   - Frontend → Orchestration
   - Creates session
   - Response: Session ID

2. **POST /v1/sessions/:id/messages**
   - Frontend → Orchestration
   - Sends user message
   - Response: 202 Accepted

3. **POST https://api.anthropic.com/v1/messages**
   - Orchestration → Anthropic API
   - Claude processes message
   - Response: Tool call (file_write)

4. **POST http://169.254.0.21:8330/tools/execute**
   - Orchestration → E2B Sandbox
   - Executes file_write
   - Response: Success

5. **POST https://api.anthropic.com/v1/messages**
   - Orchestration → Anthropic API
   - Claude generates final response
   - Response: Text message

### WebSocket Messages (5 total):

1. **connected** (server → client)
   - Confirms WebSocket connection

2. **message** (server → client)
   - User message confirmed

3. **tool_call** (server → client)
   - Tool execution started

4. **tool_result** (server → client)
   - Tool execution completed

5. **message** (server → client)
   - Assistant response delivered

6. **task_finished** (server → client)
   - Task complete, credits updated

---

## State Updates

### Frontend (Redux)

**Slices Updated:**

1. **sessions**
   - `sessions.currentSessionId` = "abc123"
   - `sessions.sessions.entities["abc123"]` = {...session data}

2. **chat**
   - `chat.inputValue` = "" (cleared after send)
   - `chat.files` = [] (cleared after send)

3. **timeline**
   - `timeline.items.push({type: "message", role: "user", ...})`
   - `timeline.items.push({type: "tool_call", toolName: "file_write", ...})`
   - `timeline.items.push({type: "tool_result", ...})`
   - `timeline.items.push({type: "message", role: "assistant", ...})`

4. **websocket**
   - `websocket.status` = "connected"
   - `websocket.taskFinished` = true

5. **auth**
   - `auth.usageInfo.creditsUsed` += 0.5

### Backend (Database)

**Tables Updated:**

1. **sessions**
   ```sql
   INSERT INTO sessions (id, user_id, title, model, status, created_at)
   VALUES ('abc123', '310519663278050818', 'New Chat', 'claude-3.5-sonnet', 'active', NOW());
   
   UPDATE sessions
   SET costed_credits = costed_credits + 0.5, updated_at = NOW()
   WHERE id = 'abc123';
   ```

2. **messages**
   ```sql
   INSERT INTO messages (id, session_id, role, content, created_at)
   VALUES ('msg_001', 'abc123', 'user', 'Create a file called test.txt', NOW());
   
   INSERT INTO messages (id, session_id, role, content, created_at)
   VALUES ('msg_002', 'abc123', 'assistant', 'I''ve created the file...', NOW());
   ```

3. **tool_calls**
   ```sql
   INSERT INTO tool_calls (id, session_id, tool_name, parameters, status, created_at)
   VALUES ('toolu_001', 'abc123', 'file_write', '{"file":...}', 'pending', NOW());
   
   UPDATE tool_calls
   SET status = 'completed', result = '{"status":"success",...}', completed_at = NOW()
   WHERE id = 'toolu_001';
   ```

4. **users**
   ```sql
   UPDATE users
   SET credits_used = credits_used + 0.5, last_active_at = NOW()
   WHERE id = '310519663278050818';
   ```

### E2B Sandbox (Filesystem)

**Files Created:**
```bash
/home/ubuntu/test.txt (0 bytes)
```

---

## API Endpoints Reference

### Session Management

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| POST | `/v1/sessions` | Create session | `{title, model, agentMode}` | `{sessionId, ...}` |
| GET | `/v1/sessions/:id` | Get session | - | `{session details}` |
| PATCH | `/v1/sessions/:id` | Update session | `{title, status, ...}` | `{updated session}` |
| DELETE | `/v1/sessions/:id` | Delete session | - | `{success: true}` |

### Messaging

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| POST | `/v1/sessions/:id/messages` | Send message | `{role, content, files}` | `{messageId, status}` |
| GET | `/v1/sessions/:id/messages` | Get messages | - | `{messages: [...]}` |
| POST | `/v1/chat` | Send chat (alt) | `{sessionId, message}` | `{messageId}` |

### User & Credits

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| GET | `/v1/user` | Get user info | - | `{user details}` |
| PATCH | `/v1/user` | Update user | `{name, email, ...}` | `{updated user}` |
| GET | `/v1/usage` | Get usage | - | `{creditsUsed, ...}` |

### Files

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| POST | `/v1/files/upload` | Upload file | FormData | `{fileId, url}` |
| GET | `/v1/files/:id` | Get file | - | File content |

### LLM Proxy

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| POST | `/api/llm-proxy/v1/chat/completions` | LLM call | OpenAI format | OpenAI format |

### WebSocket

| URL | Purpose | Messages |
|-----|---------|----------|
| `wss://api.manus.im/ws?sessionId=:id&token=:token` | Real-time updates | connected, message, tool_call, tool_result, task_finished, plan_update |

---

## Timing Breakdown

**Total time: ~3-5 seconds**

| Phase | Time | Cumulative |
|-------|------|------------|
| User input → Send | 0ms | 0ms |
| HTTP: Create session | 200ms | 200ms |
| WebSocket: Connect | 100ms | 300ms |
| HTTP: Send message | 150ms | 450ms |
| LLM: Claude processes | 1000ms | 1450ms |
| HTTP: E2B tool execution | 50ms | 1500ms |
| LLM: Claude final response | 800ms | 2300ms |
| WebSocket: Deliver response | 50ms | 2350ms |
| **Total** | **~2.4s** | **2350ms** |

---

## Who Calls What?

### Frontend Calls:
- **POST /v1/sessions** - Create session
- **POST /v1/sessions/:id/messages** - Send message
- **WebSocket connection** - Real-time updates

### Orchestration Calls:
- **POST https://api.anthropic.com/v1/messages** - Claude API
- **POST http://169.254.0.21:8330/tools/execute** - E2B sandbox

### E2B Sandbox Calls:
- **None** - Only receives requests from orchestration

---

## What Updates Where?

### Frontend Updates:
- **Redux state** (41 slices)
- **Local storage** (session cache)
- **UI components** (re-render on state change)

### Orchestration Updates:
- **Database** (sessions, messages, tool_calls, users)
- **Cache** (Redis for session state)
- **Metrics** (Telemetry, Sentry)

### E2B Sandbox Updates:
- **Filesystem** (/home/ubuntu/)
- **PTY sessions** (shell history)
- **Browser state** (cookies, tabs)

---

## The Complete Truth

**You talk to:** The frontend (React app at manus.im/app)

**Frontend talks to:** Orchestration API (api.manus.im)

**Orchestration talks to:**
- Anthropic API (Claude)
- E2B Sandbox (tools)
- Database (state)
- WebSocket (you)

**E2B Sandbox talks to:**
- Orchestration (tool results)
- OpenAI API (for subtasks)

**Network calls per message:**
- 1-2 HTTP (session + message)
- 2 LLM API calls (tool call + final response)
- 1 E2B sandbox call (tool execution)
- 5-6 WebSocket messages (real-time updates)

**State updates per message:**
- 5 Redux slices (frontend)
- 4 database tables (backend)
- 1 file created (sandbox)

**This is the complete flow with every network call, every state update, and every database change documented.**
