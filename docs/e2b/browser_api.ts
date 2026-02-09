// src/app/api/sandbox/browser/route.ts

import { NextResponse } from "next/server";
import { E2B, Sandbox } from "e2b";
import { DesktopSandbox } from "e2b_desktop";

// This is a simplified example. In a real app, you would manage the E2B
// connection more robustly, likely reusing connections.

export async function POST(req: Request) {
  const body = await req.json();
  const { sandboxId, action, args } = body;

  if (!sandboxId || !action) {
    return NextResponse.json({ error: "sandboxId and action are required" }, { status: 400 });
  }

  if (!process.env.E2B_API_KEY) {
    return NextResponse.json({ error: "E2B_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Connect to the specific running sandbox
    const sandbox = await DesktopSandbox.connect({ id: sandboxId, apiKey: process.env.E2B_API_KEY });

    switch (action) {
      case "navigate":
        await sandbox.open(args.url);
        break;
      case "back":
        // E2B Desktop SDK doesn't have a direct back/forward.
        // You would simulate this with keyboard shortcuts.
        await sandbox.keyboard.press("Alt+ArrowLeft");
        break;
      case "forward":
        await sandbox.keyboard.press("Alt+ArrowRight");
        break;
      case "refresh":
        await sandbox.keyboard.press("F5");
        break;
      default:
        await sandbox.close();
        return NextResponse.json({ error: `Unknown browser action: ${action}` }, { status: 400 });
    }

    // Close the connection after the action is performed.
    // In a real app, you might keep it open for the session.
    await sandbox.close();

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("E2B browser control error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
