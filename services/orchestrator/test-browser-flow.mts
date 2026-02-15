/**
 * E2E test: browser screenshot flow (Manus parity)
 * 1. Create sandbox via E2B REST API (no SDK needed)
 * 2. Navigate browser → get base64 WebP screenshot
 * 3. Upload to S3 → get presigned URL
 * 4. Verify URL is loadable
 */
import crypto from "node:crypto";
import fs from "node:fs";

const E2B_API_KEY = process.env.E2B_API_KEY!;
const TEMPLATE = "rubic-desktop";

// RSA auth
const PRIVATE_KEY = fs.readFileSync(
  new URL("../../e2b-templates/desktop/keys/private.pem", import.meta.url),
  "utf-8"
);

function rsaSign(body: string): Record<string, string> {
  const sign = crypto.createSign("SHA256");
  sign.update(body || "");
  return { "X-Sandbox-Api-Signature-V2": sign.sign(PRIVATE_KEY, "base64") };
}

async function main() {
  // 1. Create sandbox via E2B REST API
  console.log("1. Creating E2B sandbox...");
  const createResp = await fetch("https://api.e2b.dev/sandboxes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": E2B_API_KEY,
    },
    body: JSON.stringify({ templateID: TEMPLATE, timeout: 300 }),
  });
  if (!createResp.ok) {
    console.error("Failed:", await createResp.text());
    process.exit(1);
  }
  const sandboxInfo = (await createResp.json()) as { sandboxID: string; clientID: string };
  const sandboxId = sandboxInfo.sandboxID;
  console.log(`   Sandbox: ${sandboxId}`);

  const baseUrl = `https://8330-${sandboxId}.e2b.dev`;

  // 2. Wait for runtime
  console.log("2. Waiting for runtime...");
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${baseUrl}/health`, {
        headers: rsaSign(""),
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) { ready = true; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!ready) { console.error("   Runtime not ready!"); process.exit(1); }
  console.log("   Ready!");

  // 3. Navigate
  console.log("3. browser_navigate → https://example.com");
  const navBody = JSON.stringify({ action: "navigate", url: "https://example.com" });
  const navResp = await fetch(`${baseUrl}/browser/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...rsaSign(navBody) },
    body: navBody,
    signal: AbortSignal.timeout(45000),
  });
  const result = (await navResp.json()) as Record<string, unknown>;
  console.log(`   ok=${result.ok} title="${result.title}" elements=${result.element_count}`);

  const screenshot = result.screenshot as string;
  if (!screenshot) {
    console.error("   ❌ No screenshot!");
    process.exit(1);
  }
  if (screenshot.startsWith("/home/")) {
    console.error(`   ❌ FILE PATH (old template still active): ${screenshot}`);
    process.exit(1);
  }
  if (screenshot.length < 200) {
    console.error(`   ❌ Too short: ${screenshot}`);
    process.exit(1);
  }

  const isWebP = screenshot.startsWith("UklGR");
  console.log(`   ✅ Base64 (${screenshot.length} chars) | WebP=${isWebP}`);

  // 4. Upload to S3
  console.log("4. Uploading to S3...");
  const { uploadFile, getPresignedUrl } = await import("@repo/storage");
  const buffer = Buffer.from(screenshot, "base64");
  console.log(`   Buffer: ${buffer.length} bytes`);
  const key = `screenshots/test/${Date.now()}.webp`;
  await uploadFile(key, buffer, "image/webp");
  const url = await getPresignedUrl(key, 86400, true);
  console.log(`   ✅ S3 URL: ${url.slice(0, 100)}...`);

  // 5. Verify loadable
  console.log("5. Verifying image loads...");
  const imgResp = await fetch(url, { signal: AbortSignal.timeout(10000) });
  console.log(`   HTTP ${imgResp.status} | ${imgResp.headers.get("content-type")} | ${imgResp.headers.get("content-length")} bytes`);

  if (imgResp.status === 200) {
    console.log("\n✅ FULL MANUS-PARITY BROWSER FLOW VERIFIED");
    console.log("   Sandbox → WebP screenshot → base64 → S3 → presigned URL → loadable image");
  } else {
    console.error("\n❌ Image not loadable from S3");
  }

  // Cleanup
  console.log("\n6. Destroying sandbox...");
  await fetch(`https://api.e2b.dev/sandboxes/${sandboxId}`, {
    method: "DELETE",
    headers: { "X-API-Key": E2B_API_KEY },
  });
  console.log("   Done!");
}

main().catch(e => { console.error(e); process.exit(1); });
