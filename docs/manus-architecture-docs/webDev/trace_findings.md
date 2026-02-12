# Trace Findings: Manus Sandbox Architecture

## Services Running

1. **Neko** (port 8333): WebRTC remote desktop
   - Binary: `/opt/.manus/neko/server/neko serve`
   - Config: `/opt/.manus/neko/config/neko.yml`
   - Uses Cloudflare TURN/STUN servers for WebRTC
   - Screen: 1280x1029@30fps
   - ICE lite disabled, NAT 1:1 to 127.0.0.1

2. **code-server** (port 8329): VS Code in browser
   - Binary: `/usr/lib/code-server/lib/node /usr/lib/code-server`
   - Config: `/home/ubuntu/.config/code-server/config.yaml`
   - Runs as ubuntu user via `su -l`

3. **sandbox-runtime** (port 8330): Main API server
   - Binary: `/opt/.manus/.sandbox-runtime/start_server` (compiled Python)
   - All tool calls go through this

4. **No nginx/caddy** - no reverse proxy inside the sandbox

## Webdev Templates Available
- `app` (Expo mobile)
- `web-db-user` (Vite + React + TailwindCSS + Drizzle + MySQL/TiDB)
- `web-static` (Vite + React + TailwindCSS)

## Key API Endpoints

### Preview URL Mechanism
- The `expose` tool creates a temporary public URL for a local port
- The port info is encoded in the domain prefix
- When webdev project runs `vite dev` on port 5173 (or configured port), `expose` creates a public URL like `https://5173-{sandbox-id}.manus.computer`
- This is NOT S3 hosted - it's a live reverse proxy to the running dev server inside the sandbox

### Deploy Flow
1. `/deploy/zip-and-upload` - Zips the project directory and uploads to a presigned S3 URL
   - Takes: directory, upload_url, project_type (frontend/backend/nextjs)
   - The host provides the presigned S3 upload URL
2. The host then deploys from S3 to a hosting platform (likely Vercel/Cloudflare)

### Webdev Init Flow
1. `/webdev/init_project` - Creates project from template
   - Takes: project_name, project_title, project_config (with database connection_string, s3_sync config, secrets)
   - The host passes DATABASE_URL as connection_string in project_config.database
   - The host passes S3 credentials in project_config.s3_sync
   - The host passes secrets (env vars) in project_config.secrets
2. `/webdev/restart` - Starts/restarts the dev server
   - Takes: project_name, project_config, presigned_upload_url (for screenshots)
3. `/webdev/checkpoint` - Git commit + zip upload
   - Takes: project_name, description, project_config, checkpoint_zip_upload_url
4. `/webdev/status` - Check dev server status

### Database Config
- `ProjectDatabaseConfig` has ONE field: `connection_string` (nullable string)
- The host constructs the full `mysql://user:pass@host:port/dbname` and passes it
- The sandbox just receives it and writes it to .env as DATABASE_URL

### S3 Sync Config
- `ProjectS3Config` has: bucket, access_key, secret_key, region, session_token, sync_interval
- This is for syncing project files to S3 (not for hosting)
- sync_interval defaults to 3 seconds

### Screenshot Upload
- `project_config.screenshot_upload_url` - presigned S3 URL for uploading screenshots
- Browser screenshots are uploaded to S3, not returned in API responses
- The frontend loads screenshots from S3 URLs

## Canvas Tab Sources
1. **Browser tab**: Neko WebRTC stream (port 8333) - live remote desktop
2. **Code tab**: code-server iframe (port 8329) - live VS Code
3. **Preview tab**: Exposed port URL (e.g., port 5173) - live dev server
4. **Terminal tab**: PTY via `/terminal/{id}/write` + `/terminal/{id}/view` API
