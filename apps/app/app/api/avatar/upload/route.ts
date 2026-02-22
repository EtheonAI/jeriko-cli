import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { uploadPublicFile } from "@repo/storage";

export const POST = async (req: Request) => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return Response.json({ error: "Image must be less than 2MB" }, { status: 400 });
    }

    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      return Response.json({ error: "Only JPG, PNG, GIF, or WebP allowed" }, { status: 400 });
    }

    const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const key = `avatars/${session.user.id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const url = await uploadPublicFile(key, buffer, file.type);

    return Response.json({ url });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
};
