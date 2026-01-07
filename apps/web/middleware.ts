import { authMiddleware } from "@repo/auth/middleware";
import createMiddleware from '@repo/internationalization/middleware';
import { routing } from '@repo/internationalization/routing';
import { parseError } from "@repo/observability/error";
import { secure } from "@repo/security";
import {
  noseconeOptions,
  noseconeOptionsWithToolbar,
  securityMiddleware,
} from "@repo/security/middleware";
import { createNEMO } from "@rescale/nemo";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export const config = {
  matcher: ["/((?!_next/static|_next/image|ingest|favicon.ico).*)"],
  runtime: "nodejs",
};

const securityHeaders = env.FLAGS_SECRET
  ? securityMiddleware(noseconeOptionsWithToolbar)
  : securityMiddleware(noseconeOptions);

const i18nMiddleware = createMiddleware(routing);

const arcjetMiddleware = async (request: NextRequest) => {
  if (!env.ARCJET_KEY) {
    return;
  }

  try {
    await secure(
      [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:PREVIEW",
        "CATEGORY:MONITOR",
      ],
      request
    );
  } catch (error) {
    const message = parseError(error);
    return NextResponse.json({ error: message }, { status: 403 });
  }
};

const composedMiddleware = createNEMO(
  {},
  {
    before: [arcjetMiddleware],
  }
);

export default authMiddleware(async (_auth, request, event) => {
  const headersResponse = securityHeaders();

  // Run i18n middleware first
  const i18nResponse = await i18nMiddleware(request);
  if (i18nResponse) return i18nResponse;

  // Then run other middleware
  const middlewareResponse = await composedMiddleware(
    request as unknown as NextRequest,
    event
  );

  return middlewareResponse || headersResponse;
});
