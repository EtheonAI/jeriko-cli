# Manus E2B: Final System Specification

This report provides the definitive details on the Manus E2B startup sequence, session templates, and S3 orchestration.

## 1. Startup Scripts

These scripts initialize the VM environment and start the core services.

### /startup.sh
```bash
$(cat /home/ubuntu/startup_sh.txt)
```

### /e2b-startup.sh
```bash
$(cat /home/ubuntu/e2b_startup_sh.txt)
```

## 2. E2B Session Templates (WebDev)

These templates are used to scaffold projects in the sandbox.

**Path:** `/opt/.manus/webdev/templates/`

**Available Templates:**
$(cat /home/ubuntu/webdev_templates_list.txt | sed 's/^/- /')

## 3. S3 Orchestration & Pre-signed URLs

The Coordination Layer manages file persistence and asset delivery via S3.

### S3 Orchestration Endpoints (Sandbox Runtime)

The agent interacts with S3 through these internal API endpoints on `localhost:8330`:

- **`POST /file/upload_to_s3`**: Uploads a single file using a pre-signed URL.
- **`POST /file/upload_files_to_s3`**: Batch upload of multiple files.
- **`POST /file/multipart_upload_to_s3`**: Handles large files via S3 multipart upload.
- **`POST /renew-presigned-urls`**: Refreshes expired URLs for long-running sessions.
- **`POST /request-download-attachments`**: Downloads user-uploaded files from S3 into the sandbox.

### How it Works: The Pre-signed URL Flow

1. **Trigger**: An agent action (e.g., browser screenshot, file write) requires an external asset.
2. **Generation**: The **Coordination Layer** (external) generates a pre-signed S3 URL (PUT for uploads, GET for downloads).
3. **Delivery**: The Coordination Layer sends the tool call to the **Sandbox Runtime API** with the pre-signed URL included in the payload.
4. **Execution**: The Sandbox Runtime executes the action (e.g., takes the screenshot) and then uses the provided pre-signed URL to upload the data directly to S3 from the sandbox.
5. **Observation**: The Sandbox Runtime returns the status of the operation to the Coordination Layer.

### S3 Configuration (Environment)
$(cat /home/ubuntu/s3_env_redacted.txt | sed 's/^/- /')

