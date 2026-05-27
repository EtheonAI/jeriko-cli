import { env } from "@/env";

export const legalLinks = {
  privacy: new URL("/legal/privacy", env.NEXT_PUBLIC_WEB_URL).toString(),
  terms: new URL("/legal/terms", env.NEXT_PUBLIC_WEB_URL).toString(),
} as const;
