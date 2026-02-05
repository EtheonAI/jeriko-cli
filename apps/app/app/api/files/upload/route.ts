import { auth } from "@repo/auth";
import { headers } from "next/headers";

const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || "http://localhost:4005";

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

    const formData = await req.formData();
    const path = formData.get("path") as string | null;

    const response = await fetch(`${FILE_SERVICE_URL}/upload`, {
      method: "POST",
      headers: {
        "x-user-id": session.user.id,
        ...(path ? { "x-path": path } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: error || "Upload failed" }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
