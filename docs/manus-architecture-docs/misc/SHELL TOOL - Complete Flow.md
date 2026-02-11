# SHELL TOOL - Complete Flow

## Process Chain Discovery

When I call `shell.exec(command="echo test")`:

```
start_server (PID 794)
    └── spawns PTY master (fd 21, 22, 23)
        └── /usr/bin/sudo -n su ubuntu (PID 14783)
            └── su ubuntu (PID 14787)
                └── bash (PID 14788) [/dev/pts/11]
                    └── executes: echo test
```

## Detailed Flow

### 1. **User Prompt**
```
User: "List files in home directory"
```

### 2. **Frontend → Orchestration**
```
POST https://api.manus.im/v1/chat
Body: {
  "message": "List files in home directory",
  "conversation_id": "...",
  "user_id": "..."
}
```

### 3. **Orchestration → LLM API**
```
POST https://api.manus.im/api/llm-proxy/v1/chat/completions
Headers: {
  "Authorization": "Bearer <internal_token>"
}
Body: {
  "model": "claude-3.5-sonnet",
  "messages": [
    {"role": "user", "content": "List files in home directory"}
  ],
  "tools": [
    {
      "name": "shell",
      "description": "Execute shell commands...",
      "parameters": {...}
    },
    ... (all 27 tools)
  ]
}
```

### 4. **LLM (Me) Returns Function Call**
```json
{
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "shell",
        "arguments": "{\"action\":\"exec\",\"command\":\"ls -la /home/ubuntu\",\"session\":\"default\",\"brief\":\"List files in home directory\"}"
      }
    }
  ]
}
```

### 5. **Orchestration Receives Function Call**
- Parses the function call
- Validates parameters
- Prepares to send to sandbox

### 6. **Orchestration → E2B Sandbox (WebSocket)**
```
WebSocket Message to 169.254.0.21:8330
{
  "type": "tool_call",
  "tool": "shell",
  "action": "exec",
  "parameters": {
    "command": "ls -la /home/ubuntu",
    "session": "default",
    "timeout": 30
  },
  "call_id": "call_abc123"
}
```

### 7. **start_server Receives Command**
- Listening on port 8330 (WebSocket/gRPC)
- Receives tool call message
- Routes to shell handler

### 8. **Shell Handler in start_server**
```python
# Pseudocode of what happens inside start_server
def handle_shell_exec(command, session, timeout):
    # Get or create PTY for session
    pty = get_or_create_pty(session)  # Uses /dev/ptmx
    
    # Spawn shell if needed
    if not pty.shell_running:
        # Fork process
        pid = fork()
        if pid == 0:  # Child process
            # Execute: sudo -n su ubuntu
            exec(["/usr/bin/sudo", "-n", "su", "ubuntu"])
    
    # Send command to PTY
    pty.write(command + "\n")
    
    # Read output with timeout
    output = pty.read_until_prompt(timeout)
    
    return output
```

### 9. **Actual Execution in Sandbox**
```
start_server (PID 794) opens /dev/ptmx
    ↓
Creates PTY pair: master (fd 21) ↔ slave (/dev/pts/11)
    ↓
Forks and execs: sudo -n su ubuntu
    ↓
Shell starts: bash (PID 14788)
    ↓
Command written to PTY: "ls -la /home/ubuntu\n"
    ↓
Bash executes: ls -la /home/ubuntu
    ↓
Output written to PTY
    ↓
start_server reads from PTY master
```

### 10. **Output Captured**
```
total 123
drwxr-x--- 16 ubuntu ubuntu 4096 Feb  9 14:41 .
drwxr-xr-x  3 root   root   4096 Feb  5 15:16 ..
-rw-r--r--  1 ubuntu ubuntu  220 Feb  5 15:16 .bash_logout
-rw-r--r--  1 ubuntu ubuntu 3771 Feb  5 15:16 .bashrc
...
```

### 11. **start_server → Orchestration (WebSocket)**
```
WebSocket Message to 10.9.181.1
{
  "type": "tool_result",
  "call_id": "call_abc123",
  "status": "success",
  "output": "total 123\ndrwxr-x--- 16 ubuntu ubuntu...",
  "exit_code": 0,
  "duration_ms": 45
}
```

### 12. **Orchestration → LLM**
```
POST https://api.manus.im/api/llm-proxy/v1/chat/completions
Body: {
  "messages": [
    {"role": "user", "content": "List files in home directory"},
    {
      "role": "assistant",
      "tool_calls": [...]
    },
    {
      "role": "tool",
      "tool_call_id": "call_abc123",
      "content": "total 123\ndrwxr-x--- 16 ubuntu ubuntu..."
    }
  ]
}
```

### 13. **LLM (Me) Processes Result**
- Sees the output
- Decides to respond to user
- Formats response

### 14. **LLM Returns Response**
```json
{
  "content": "Here are the files in your home directory:\n\n- .bashrc\n- .profile\n- Documents/\n..."
}
```

### 15. **Orchestration → Frontend**
```
WebSocket Message
{
  "type": "message",
  "content": "Here are the files in your home directory...",
  "status": "complete"
}
```

### 16. **Frontend → User**
- Displays message in chat interface
- User sees the response

## Network Calls Summary

### Outbound from E2B Sandbox:
1. **WebSocket to Orchestration**: `169.254.0.21:8330 → 10.9.181.1:60572`
   - Tool results
   - Status updates
   - Streaming output

2. **HTTPS to AWS**: `169.254.0.21 → 44.193.41.67:443`
   - Telemetry (OpenTelemetry)
   - Error reporting (Sentry)
   - Asset uploads (S3)

### Inbound to E2B Sandbox:
1. **WebSocket from Orchestration**: `10.9.181.1:60572 → 169.254.0.21:8330`
   - Tool call commands
   - Configuration updates
   - Control messages

## File System Impact

### Created:
- None (ls command doesn't create files)

### Read:
- `/home/ubuntu/` directory listing

### Modified:
- None

## Session Management

### PTY Sessions:
- **Session ID**: "default" (or custom name)
- **Persistence**: Lasts for entire conversation
- **State**: Shell history, environment variables, current directory
- **Cleanup**: Terminated when sandbox shuts down

### Multiple Sessions:
```python
shell.exec(command="cd /tmp", session="session1")
shell.exec(command="pwd", session="session1")  # Output: /tmp

shell.exec(command="pwd", session="session2")  # Output: /home/ubuntu
```

## Performance Metrics

- **Tool call overhead**: ~5-10ms (orchestration → sandbox)
- **Command execution**: Variable (depends on command)
- **Result return**: ~5-10ms (sandbox → orchestration)
- **Total latency**: ~20-50ms + command execution time

## Error Handling

### Timeout:
```python
shell.exec(command="sleep 60", timeout=5)
# After 5 seconds: TimeoutError
# Process killed with SIGTERM
```

### Command Failure:
```python
shell.exec(command="ls /nonexistent")
# Returns exit code 2
# stderr captured and returned
```

### Session Crash:
```python
shell.exec(command="kill -9 $$")  # Kills the shell
# Next command in same session: spawns new shell
```

## Key Insights

1. **PTY Management**: start_server manages PTY pairs for each session
2. **Process Isolation**: Each session runs in separate bash process
3. **WebSocket Streaming**: Real-time output streaming via WebSocket
4. **No Direct LLM**: Shell execution doesn't call LLM (unless command does)
5. **Persistent Sessions**: Shell state maintained across multiple commands
