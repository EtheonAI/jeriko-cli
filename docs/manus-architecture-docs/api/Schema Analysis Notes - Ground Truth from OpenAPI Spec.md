# Schema Analysis Notes - Ground Truth from OpenAPI Spec

## Authentication Mechanism
- **RSA Signature-based**: Uses `X-Sandbox-Api-Signature-V2`, `X-Sandbox-Api-Nonce`, `X-Sandbox-Api-Timestamp` headers
- NOT Bearer token auth — the Coordination Layer signs each request with an RSA private key
- The sandbox verifies the signature with a corresponding public key
- This means: the Coordination Layer is the ONLY entity that can call these endpoints
- I (the agent/LLM) CANNOT call these endpoints directly from inside the sandbox

## Complete Endpoint Inventory (63 endpoints)

### Core Tool Execution (what the Coordination Layer calls on behalf of the LLM)
1. `POST /browser/action` — Execute browser actions (navigate, click, input, scroll, etc.)
2. `GET /browser/status` — Get current browser state
3. `POST /text_editor` — File operations (view, create, write, str_replace, multi_edit, glob, grep)
4. `GET /terminal/{terminal_id}/view` — View terminal output
5. `POST /terminal/{terminal_id}/write` — Write to terminal (execute commands)
6. `POST /terminal/{terminal_id}/kill` — Kill terminal process
7. `POST /terminal/{terminal_id}/reset` — Reset terminal
8. `POST /terminal/reset-all` — Reset all terminals

### File Transfer & S3 Operations
9. `POST /file/upload_to_s3` — Upload a single file to S3 via presigned URL
10. `POST /file/upload_files_to_s3` — Upload multiple files to S3
11. `POST /file/multipart_upload_to_s3` — Multipart upload for large files
12. `POST /file/files_exist` — Check if files exist (relative paths)
13. `POST /file/files_exist_abs` — Check if files exist (absolute paths)
14. `POST /file/batch_read` — Batch read multiple files
15. `POST /file/store_parallel_tasks_result` — Store map/reduce results
16. `GET /file` — Get file info
17. `POST /request-download-attachments` — Download user attachments from S3 into sandbox
18. `POST /request-download-user-edited` — Download user-edited files from S3
19. `POST /request-download-gmail-attachments` — Download Gmail attachments
20. `POST /renew-presigned-urls` — Renew expired S3 presigned URLs
21. `POST /search_image/upload` — Upload search result images to S3

### Sandbox Lifecycle
22. `POST /init-sandbox` — Initialize sandbox with secrets, session_id, browser data S3 URL, neko ICE servers
23. `GET /healthz` — Health check
24. `GET /version` — Get runtime version
25. `POST /config/set-env` — Set environment variables and enable MCP servers
26. `GET /config/github-auth-status` — Check GitHub auth status
27. `POST /clear-browser-data` — Clear browser data
28. `POST /notify-manus-browser-config-update` — Notify browser config update

### Email Operations
29. `POST /gmail/send-or-save-draft` — Send Gmail or save draft (receives access_token from Coordination Layer)
30. `POST /outlook/send-or-save-draft` — Send Outlook email or save draft
31. `POST /outlook/download-mail-attachments` — Download Outlook attachments

### Web Development
32. `POST /webdev/init_project` — Initialize a web project
33. `POST /webdev/status` — Get project status
34. `POST /webdev/restart` — Restart dev server
35. `POST /webdev/checkpoint` — Save checkpoint
36. `POST /webdev/rollback` — Rollback to checkpoint
37. `POST /webdev/restore` — Restore project
38. `POST /webdev/config` — Update project config
39. `POST /webdev/database` — Execute database operations
40. `POST /webdev/git-push` — Push to Git
41. `POST /webdev/git-sync-check` — Check Git sync status
42. `POST /webdev/refresh_s3_token` — Refresh S3 token for webdev
43. `POST /webdev/refresh_github_token` — Refresh GitHub token
44. `POST /webdev/apply_webpage_edits` — Apply webpage edits
45. `POST /webdev/setup_imported_template` — Setup imported template

### Deployment
46. `POST /deploy/zip-and-upload` — Zip project and upload for deployment
47. `POST /deploy/switch-version` — Switch deployment version
48. `POST /deploy/create-webdev-project` — Create webdev project for deployment

### Slides
49. `POST /slide/init-project` — Initialize slide project
50. `POST /slide/present` — Present slides
51. `POST /slide/upload-resources` — Upload slide resources
52. `POST /slide/update-state` — Update slide state
53. `POST /slide/modify` — Modify slides
54. `POST /slide/upload_template_image` — Upload slide template image
55. `POST /slide/notes` — Fetch slide notes

### User-Facing Services (Pre-auth)
56. `GET /code-server/pre-auth` — Pre-authenticate for Code Server (IDE)
57. `POST /code-server/auth` — Authenticate Code Server
58. `GET /neko/pre-auth` — Pre-authenticate for Neko (WebRTC live view)
59. `GET /vnc/pre-auth` — Pre-authenticate for VNC
60. `POST /refresh/turn_token` — Refresh TURN server token for WebRTC

### Skills
61. `POST /sync-skills` — Sync skills
62. `POST /skills/sync-skills` — Sync skills (duplicate)
63. `POST /skills/package-skill` — Package a skill

### Image Processing
64. `POST /image/rmbg` — Remove background from image

## Key Schema Findings

### BrowserActionRequest
- `action`: The browser action to perform (one of 19 action types)
- `screenshot_presigned_url`: S3 URL where the annotated screenshot will be uploaded
- `clean_screenshot_presigned_url`: S3 URL for the clean (unannotated) screenshot
- `cloudflare_auth_headers`: Auth headers for Cloudflare-protected uploads

### TextEditorAction (File Tool)
- Commands: view, create, write, str_replace, multi_edit, find_content, find_file, glob, grep
- `presigned_upload_url`: S3 URL for uploading the file content after write
- `presigned_upload_urls`: Multiple S3 URLs (for multi-file operations)
- `view_type`: "text" or "image" (for viewing images/PDFs)
- `previous_content_hash`: For optimistic concurrency control

### InitSandboxCmd
- `secrets`: Key-value pairs of environment variables/secrets
- `session_id`: The current session ID
- `browser_user_data_s3_url`: S3 URL for browser profile data
- `enable_browser_data_sync`: Whether to sync browser data
- `sandbox_id`: The E2B sandbox identifier
- `neko_ice_servers_json`: ICE server config for WebRTC

### FileUploadCmd
- `file_path`: Local path in sandbox
- `presigned_url`: S3 URL to upload to
- `file_type`: "file" or "multimodal_image"

### GmailComposeCmd
- `access_token`: OAuth access token (passed by Coordination Layer, NOT stored locally)
- Email fields: to, cc, bcc, subject, text, attachments, thread_id

### SetEnvCmd
- `secrets`: Array of SecretConfig objects
- `enabledBuiltInMCP`: Array of BuiltInMCP objects (MCP servers to enable)
