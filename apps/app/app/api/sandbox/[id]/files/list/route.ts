import { auth } from "@repo/auth";
import { headers } from "next/headers";

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

export const GET = async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path") ?? "/home/user";

    const resp = await fetch(
      `${SANDBOX_SERVICE_URL}/sandboxes/${id}/files/list?path=${encodeURIComponent(path)}`,
      {
        headers: {
          "x-user-id": session.user.id,
        },
        signal: AbortSignal.timeout(30_000),
      }
    );

    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
