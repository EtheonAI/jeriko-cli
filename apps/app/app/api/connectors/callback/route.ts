import { NextRequest, NextResponse } from "next/server";

/**
 * OAuth callback handler — Composio redirects here after OAuth completes.
 *
 * Composio sends query params:
 *   ?type=github&status=success&connected_account_id=ca_abc123
 *   ?type=github&status=failed&connected_account_id=ca_abc123
 *
 * This page extracts those params, posts them to the parent window
 * (Applications page), and closes itself. The parent then polls the
 * connector service to confirm the connection status.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "";
  const status = request.nextUrl.searchParams.get("status") ?? "done";
  const connectedAccountId =
    request.nextUrl.searchParams.get("connected_account_id") ?? "";

  // Use specific origin for secure postMessage (not wildcard)
  const origin = request.nextUrl.origin;

  // JSON.stringify the values to safely embed them in the script tag
  // and prevent XSS via query param injection
  const payload = JSON.stringify({
    type: "composio-oauth-callback",
    toolkit: type,
    status,
    connectedAccountId,
  });

  const html = `<!DOCTYPE html>
<html>
<head><title>Connecting...</title></head>
<body>
<p>Connection complete. This window will close automatically.</p>
<script>
  if (window.opener) {
    window.opener.postMessage(${payload}, ${JSON.stringify(origin)});
  }
  setTimeout(function() { window.close(); }, 500);
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
