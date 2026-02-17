import { auth } from "@repo/auth";
import { headers } from "next/headers";
import {
  uploadFile,
  getPresignedUrl,
  getStorageKey,
  calculateChecksum,
} from "@repo/storage";
import { db, files } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

export const POST = async (req: Request) => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const path = (formData.get("path") as string) || "/";
    const sessionId = (formData.get("sessionId") as string) || null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileId = createId();
    const key = getStorageKey(userId, fileId, file.name);
    const mimeType = file.type || "application/octet-stream";

    // Upload to S3
    await uploadFile(key, buffer, mimeType);

    const checksum = calculateChecksum(buffer);

    // Create DB record so the file appears in the /files page
    const [record] = await db
      .insert(files)
      .values({
        id: fileId,
        userId,
        sessionId,
        name: file.name,
        path,
        mimeType,
        size: buffer.length,
        storageKey: key,
        storageProvider: "s3",
        checksum,
      })
      .returning();

    // Get a presigned download URL (24h expiry, prefer CDN if configured)
    const url = await getPresignedUrl(key, 86400, true);

    return new Response(JSON.stringify({ url, file: record }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("File upload error:", error);
    return new Response(JSON.stringify({ error: "Upload failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
