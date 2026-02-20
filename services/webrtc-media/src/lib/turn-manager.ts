/**
 * Cloudflare TURN credential cache + rotation.
 *
 * Fetches TURN credentials from Cloudflare's API, caches them with 12-hour refresh.
 * Falls back to STUN-only if Cloudflare env vars are not configured.
 */

import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "turn-manager" });

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface IceServersResponse {
  iceServers: IceServer[];
  ttl: number;
}

const CLOUDFLARE_TURN_KEY_ID = process.env.CLOUDFLARE_TURN_KEY_ID;
const CLOUDFLARE_TURN_TOKEN = process.env.CLOUDFLARE_TURN_TOKEN;
const CLOUDFLARE_API = "https://rtc.live.cloudflare.com/v1/turn/keys";

// Cache TURN credentials — refresh every 12 hours (TTL = 24h)
let cachedIceServers: IceServersResponse | null = null;
let cacheTimestamp = 0;
const CACHE_REFRESH_MS = 12 * 60 * 60 * 1000; // 12 hours
const CREDENTIAL_TTL = 86400; // 24 hours (what we request from Cloudflare)

const STUN_FALLBACK: IceServersResponse = {
  iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  ttl: 86400,
};

async function fetchCloudflareCredentials(): Promise<IceServersResponse> {
  if (!CLOUDFLARE_TURN_KEY_ID || !CLOUDFLARE_TURN_TOKEN) {
    return STUN_FALLBACK;
  }

  const url = `${CLOUDFLARE_API}/${CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_TURN_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl: CREDENTIAL_TTL }),
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`Cloudflare TURN API ${resp.status}: ${detail}`);
  }

  const data = (await resp.json()) as {
    iceServers?: { urls: string[]; username: string; credential: string }[];
  };

  if (!data.iceServers?.length) {
    throw new Error("Cloudflare returned empty iceServers");
  }

  return {
    iceServers: data.iceServers,
    ttl: CREDENTIAL_TTL,
  };
}

export async function getIceServers(): Promise<IceServersResponse> {
  const now = Date.now();

  // Return cached if fresh
  if (cachedIceServers && now - cacheTimestamp < CACHE_REFRESH_MS) {
    return cachedIceServers;
  }

  try {
    cachedIceServers = await fetchCloudflareCredentials();
    cacheTimestamp = now;
    logger.info("TURN credentials refreshed");
    return cachedIceServers;
  } catch (err) {
    logger.warn({ error: err instanceof Error ? err.message : String(err) }, "TURN credential fetch failed, using fallback");
    // Return stale cache if available, otherwise STUN fallback
    return cachedIceServers ?? STUN_FALLBACK;
  }
}
