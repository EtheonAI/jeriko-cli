/**
 * Upload neko-client files to S3 for CDN-hosted serving.
 *
 * Manus pattern: host the Neko web client on CDN (files.manuscdn.com/neko-client/)
 * instead of serving from inside each sandbox. This means:
 * - Faster load (CDN-cached)
 * - Smaller E2B template (no www files baked in)
 * - Easy updates (upload once, all sandboxes get new client)
 *
 * Usage: cd services/orchestrator && npx tsx src/scripts/upload-neko-client.ts
 *
 * Requires S3 env vars in .env:
 *   S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const S3_PREFIX = "neko-client";
const WWW_DIR = path.resolve(__dirname, "../../../../e2b-templates/desktop/rubic-files/neko/client");

const MIME_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".xml": "application/xml",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

function listAllFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listAllFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}


async function main() {
  console.log("================================================================");
  console.log("  Upload Neko Client to S3");
  console.log("================================================================\n");

  const storageMod = await import("@repo/storage");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESM default export workaround
  const storage = (storageMod as any).default ?? storageMod;

  const config = storage.getStorageConfig();
  console.log(`  Bucket: ${config.bucket}`);
  console.log(`  Region: ${config.region}`);
  console.log(`  CDN:    ${config.cdnUrl || "(not configured - will use S3 URLs)"}`);
  console.log(`  Prefix: ${S3_PREFIX}/`);
  console.log(`  Source: ${WWW_DIR}\n`);

  if (!fs.existsSync(WWW_DIR)) {
    console.error(`  ERROR: www directory not found at ${WWW_DIR}`);
    process.exit(1);
  }

  const allFiles = listAllFiles(WWW_DIR);
  console.log(`  Found ${allFiles.length} files to upload\n`);

  let uploaded = 0;
  let errors = 0;

  for (const filePath of allFiles) {
    const relPath = path.relative(WWW_DIR, filePath);
    const s3Key = `${S3_PREFIX}/${relPath}`;
    const contentType = getMimeType(filePath);
    try {
      const body = fs.readFileSync(filePath);
      await storage.uploadFile(s3Key, body, contentType);
      console.log(`  [OK] ${s3Key} (${contentType.split(";")[0]}, ${body.length} bytes)`);
      uploaded++;
    } catch (err) {
      console.error(`  [FAIL] ${s3Key}: ${err instanceof Error ? err.message : err}`);
      errors++;
    }
  }

  console.log("\n================================================================");
  console.log(`  Results: ${uploaded} uploaded, ${errors} failed`);

  const baseUrl = config.cdnUrl
    ? `${config.cdnUrl}/${S3_PREFIX}`
    : `https://${config.bucket}.s3.${config.region}.amazonaws.com/${S3_PREFIX}`;
  console.log(`\n  Neko Client Base URL: ${baseUrl}`);
  console.log(`  Full URL: ${baseUrl}/autoconnect.html?server=<SANDBOX_URL>&usr=Rubic&pwd=neko`);
  console.log(`\n  Set in sandbox service .env:`);
  console.log(`    NEKO_CLIENT_URL=${baseUrl}`);
  console.log("================================================================\n");

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
