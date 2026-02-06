import { NextRequest, NextResponse } from "next/server";

/**
 * White-label OAuth redirect proxy.
 * When using custom OAuth apps (white-label), configure the OAuth provider's
 * callback URL to: https://yourdomain.com/api/connectors/redirect
 *
 * This route forwards the callback to Composio's backend which captures
 * the auth tokens, then Composio redirects the user to our callback page.
 */
export async function GET(request: NextRequest) {
  const composioCallbackUrl = "https://backend.composio.dev/api/v3/toolkits/auth/callback";
  const params = request.nextUrl.searchParams.toString();
  return NextResponse.redirect(`${composioCallbackUrl}?${params}`);
}
