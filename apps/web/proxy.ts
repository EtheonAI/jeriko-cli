import createMiddleware from "@repo/internationalization/middleware";
import { routing } from "@repo/internationalization/routing";
import { parseError } from "@repo/observability/error";
import { secure } from "@repo/security";
import {
  noseconeOptions,
  noseconeOptionsWithToolbar,
  securityMiddleware,
} from "@repo/security/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export const config = {
  matcher: ["/((?!_next|_vercel|ingest|.*\\..*).*)"],
};

const securityHeaders = env.FLAGS_SECRET
  ? securityMiddleware(noseconeOptionsWithToolbar)
  : securityMiddleware(noseconeOptions);

const i18nMiddleware = createMiddleware(routing);

const shouldRunI18n = (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  return !pathname.startsWith("/api");
};

const arcjetMiddleware = async (request: NextRequest) => {
  if (!env.ARCJET_KEY) {
    return;
  }

  try {
    await secure(["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW", "CATEGORY:MONITOR"], request);
  } catch (error) {
    const message = parseError(error);
    return NextResponse.json({ error: message }, { status: 403 });
  }
};

export default async function proxy(req: NextRequest) {
  const arcjetResponse = await arcjetMiddleware(req);
  if (arcjetResponse) return arcjetResponse;

  const headersResponse = await securityHeaders();

  if (shouldRunI18n(req)) {
    const i18nResponse = await i18nMiddleware(req);
    if (i18nResponse) return i18nResponse;
  }

  return headersResponse;
}
