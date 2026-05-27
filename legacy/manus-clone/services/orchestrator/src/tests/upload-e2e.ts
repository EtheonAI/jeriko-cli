/**
 * End-to-end test for the S3 presigned URL upload flow.
 *
 * Tests:
 * 1. Direct S3 presigned PUT/GET (storage package)
 * 2. Upload API endpoint (/api/upload/presign) — auth checks against external orchestrator
 * 3. Full flow (in-process): spin up Fastify → register token → presign → PUT to S3 → GET → verify
 *
 * Run: cd services/orchestrator && npx tsx src/tests/upload-e2e.ts
 * Required env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET, AWS_REGION
 */

import crypto from "node:crypto";

// ─── Config ──────────────────────────────────────────────────────────────
const ORCHESTRATOR_URL = `http://localhost:${process.env.PORT || 4014}`;
const TEST_PORT = 4099; // In-process test server port
const TEST_FILE_CONTENT = `Hello from Jeriko upload test! Timestamp: ${Date.now()}`;
const TEST_FILENAME = "test-upload.txt";

let passed = 0;
let failed = 0;

function log(icon: string, msg: string) {
  console.log(`  ${icon} ${msg}`);
}

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`\n[TEST] ${name} ... `);
  try {
    await fn();
    console.log("PASS");
    passed++;
  } catch (err) {
    console.log("FAIL");
    log("!", err instanceof Error ? err.message : String(err));
    failed++;
  }
}

// ─── Layer 1: Direct S3 presigned URL test ────────────────────────────────

async function testDirectS3() {
  const storageMod = await import("@repo/storage");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESM default export workaround
  const storage = (storageMod as any).default ?? storageMod;

  const testKey = `test/upload-e2e/${crypto.randomBytes(8).toString("hex")}_${TEST_FILENAME}`;

  await test("Generate presigned PUT URL", async () => {
    const url = await storage.getPresignedUploadUrl(testKey, "text/plain", 3600);
    if (!url || typeof url !== "string") throw new Error("No URL returned");
    if (!url.includes("X-Amz-Signature")) throw new Error("URL doesn't look like a presigned URL");
    log("->", `PUT URL: ${url.substring(0, 80)}...`);
  });

  let putUrl: string;
  let getUrl: string;

  await test("Upload file to S3 via presigned PUT", async () => {
    putUrl = await storage.getPresignedUploadUrl(testKey, "text/plain", 3600);

    const resp = await fetch(putUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/plain" },
      body: TEST_FILE_CONTENT,
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`S3 PUT failed: ${resp.status} ${body.substring(0, 200)}`);
    }
    log("->", `Uploaded ${TEST_FILE_CONTENT.length} bytes to s3://${testKey}`);
  });

  await test("Generate presigned GET URL and download", async () => {
    getUrl = await storage.getPresignedUrl(testKey, 3600);
    if (!getUrl) throw new Error("No GET URL returned");

    const resp = await fetch(getUrl);
    if (!resp.ok) throw new Error(`S3 GET failed: ${resp.status}`);

    const content = await resp.text();
    if (content !== TEST_FILE_CONTENT) {
      throw new Error(`Content mismatch!\n  Expected: ${TEST_FILE_CONTENT}\n  Got: ${content}`);
    }
    log("->", `Downloaded and verified: "${content.substring(0, 50)}..."`);
  });

  await test("CDN URL generation", async () => {
    const cdnUrl = storage.getCdnUrl(testKey);
    log("->", cdnUrl ? `CDN URL: ${cdnUrl}` : "No CDN_URL configured (presigned URLs used instead)");
  });

  await test("Cleanup: delete test file from S3", async () => {
    await storage.deleteFile(testKey);
    log("->", `Deleted s3://${testKey}`);
  });
}

// ─── Layer 2: Upload API endpoint test (external orchestrator) ───────────

async function testUploadAPIAuth() {
  await test("Orchestrator health check", async () => {
    const resp = await fetch(`${ORCHESTRATOR_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);

    if (!resp || !resp.ok) {
      throw new Error(`Orchestrator not reachable at ${ORCHESTRATOR_URL}. Start it with: pnpm --filter orchestrator dev`);
    }
    log("->", "Orchestrator is running");
  });

  await test("Upload health check", async () => {
    const resp = await fetch(`${ORCHESTRATOR_URL}/api/upload/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) throw new Error(`Upload health failed: ${resp.status}`);
    const data = await resp.json() as Record<string, unknown>;
    log("->", `Upload health: ${JSON.stringify(data)}`);
    if (!data.s3Configured) throw new Error("S3 is not configured on orchestrator");
  });

  await test("Upload presign rejects unauthenticated requests", async () => {
    const resp = await fetch(`${ORCHESTRATOR_URL}/api/upload/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "test.txt" }),
    });
    if (resp.status !== 401) throw new Error(`Expected 401, got ${resp.status}`);
    log("->", "Correctly rejected (401)");
  });

  await test("Upload presign rejects invalid tokens", async () => {
    const resp = await fetch(`${ORCHESTRATOR_URL}/api/upload/presign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-jeriko-FAKE_TOKEN_INVALID",
      },
      body: JSON.stringify({ filename: "test.txt" }),
    });
    if (resp.status !== 401) throw new Error(`Expected 401, got ${resp.status}`);
    log("->", "Correctly rejected invalid token (401)");
  });
}

// ─── Layer 3: Full flow (in-process Fastify) ─────────────────────────────
// Spins up a Fastify instance in-process so registerTestProxyToken() and
// the upload route share the same memory (same proxyTokenMap).

async function testFullFlow() {
  const Fastify = (await import("fastify")).default;
  const { uploadRoutes } = await import("../routes/upload.js");
  const { registerTestProxyToken } = await import("../lib/e2b-manager.js");

  const app = Fastify({ logger: false });
  await app.register(uploadRoutes);

  const testToken = `sk-jeriko-test-${crypto.randomBytes(16).toString("base64url")}`;
  const testSessionId = `test-session-${crypto.randomBytes(8).toString("hex")}`;
  const testUserId = `test-user-${crypto.randomBytes(8).toString("hex")}`;
  const testUrl = `http://localhost:${TEST_PORT}`;

  let s3Key: string | undefined;

  try {
    await app.listen({ port: TEST_PORT, host: "0.0.0.0" });
    log("->", `Test server started on port ${TEST_PORT}`);

    await test("Register test proxy token", async () => {
      registerTestProxyToken(testToken, {
        sandboxId: "test-sandbox-upload",
        userId: testUserId,
        sessionId: testSessionId,
      });
      log("->", `Registered token: ${testToken.substring(0, 20)}...`);
    });

    await test("Presign rejects missing filename (400)", async () => {
      const resp = await fetch(`${testUrl}/api/upload/presign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${testToken}`,
        },
        body: JSON.stringify({}),
      });
      if (resp.status !== 400) throw new Error(`Expected 400, got ${resp.status}`);
      log("->", "Correctly rejected missing filename (400)");
    });

    await test("Full flow: presign -> upload -> download -> verify", async () => {
      // Step 1: Get presigned URL from in-process server
      const presignResp = await fetch(`${testUrl}/api/upload/presign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${testToken}`,
        },
        body: JSON.stringify({ filename: TEST_FILENAME }),
      });

      if (!presignResp.ok) {
        const body = await presignResp.text();
        throw new Error(`Presign failed: ${presignResp.status} ${body.substring(0, 200)}`);
      }

      const presignData = await presignResp.json() as {
        uploadUrl: string;
        accessUrl: string;
        s3Key: string;
        contentType: string;
      };

      s3Key = presignData.s3Key;

      if (!presignData.uploadUrl?.includes("X-Amz-Signature")) {
        throw new Error("uploadUrl doesn't look like a presigned URL");
      }
      log("->", `Presigned PUT URL: ${presignData.uploadUrl.substring(0, 80)}...`);
      log("->", `Access URL: ${presignData.accessUrl.substring(0, 80)}...`);
      log("->", `S3 Key: ${presignData.s3Key}`);
      log("->", `Content-Type: ${presignData.contentType}`);

      // Step 2: Upload file directly to S3 using presigned PUT URL
      const putResp = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: TEST_FILE_CONTENT,
      });

      if (!putResp.ok) {
        const body = await putResp.text();
        throw new Error(`S3 PUT failed: ${putResp.status} ${body.substring(0, 200)}`);
      }
      log("->", `Uploaded ${TEST_FILE_CONTENT.length} bytes to S3`);

      // Step 3: Download file using access URL and verify content
      const getResp = await fetch(presignData.accessUrl);
      if (!getResp.ok) throw new Error(`GET access URL failed: ${getResp.status}`);

      const content = await getResp.text();
      if (content !== TEST_FILE_CONTENT) {
        throw new Error(`Content mismatch!\n  Expected: ${TEST_FILE_CONTENT}\n  Got: ${content}`);
      }
      log("->", `Downloaded and verified: "${content.substring(0, 50)}..."`);
      log("->", "FULL FLOW VERIFIED: presign -> S3 PUT -> access URL GET -> content match");
    });

    await test("Cleanup: delete uploaded test file from S3", async () => {
      if (!s3Key) {
        log("->", "No s3Key - skipping cleanup");
        return;
      }
      const storageMod = await import("@repo/storage");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ESM default export workaround
      const storage = (storageMod as any).default ?? storageMod;
      await storage.deleteFile(s3Key);
      log("->", `Deleted s3://${s3Key}`);
    });
  } finally {
    await app.close();
    log("->", "Test server stopped");
  }
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("===================================================================");
  console.log("  Jeriko S3 Upload - End-to-End Tests");
  console.log("===================================================================");

  console.log("\n-- Layer 1: Direct S3 Presigned URL Tests --");
  await testDirectS3();

  console.log("\n-- Layer 2: Upload API Auth Tests (external orchestrator) --");
  await testUploadAPIAuth();

  console.log("\n-- Layer 3: Full Flow (in-process Fastify) --");
  await testFullFlow();

  console.log("\n===================================================================");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("===================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
