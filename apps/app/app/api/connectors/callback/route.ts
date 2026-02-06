import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth callback handler — after Composio processes the auth tokens,
 * it redirects the user here. This page auto-closes the popup window
 * and signals the parent (Applications page) to refresh.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "";

  // Return a small HTML page that posts a message to the opener and closes itself
  const html = `<!DOCTYPE html>
<html>
<head><title>Connecting...</title></head>
<body>
<p>Connection complete. This window will close automatically.</p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "composio-oauth-callback", toolkit: "${type}", status: "done" }, "*");
  }
  window.close();
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
