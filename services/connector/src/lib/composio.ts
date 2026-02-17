import { Composio } from "@composio/core";
import { requireEnv } from "@repo/service-utils";

let _client: Composio | null = null;
let _toolkitVersions: Record<string, string> | null = null;

export function getComposioClient(): Composio {
  if (!_client) {
    const apiKey = requireEnv("COMPOSIO_API_KEY");
    _client = new Composio({
      apiKey,
      // Versions are resolved lazily via resolveToolkitVersions() and passed to execute calls
    });
  }
  return _client;
}

/**
 * Fetches and caches toolkit versions from the Composio API.
 * Returns a map of { gmail: "20260212_00", github: "20250909_00", ... }
 * Used to pin versions in tools.execute() calls (required by SDK v0.6.3+).
 */
export async function resolveToolkitVersions(): Promise<Record<string, string>> {
  if (_toolkitVersions) return _toolkitVersions;

  const composio = getComposioClient();
  try {
    const result = await (composio as any).client.toolkits.list();
    const items = result?.items ?? result ?? [];
    const versions: Record<string, string> = {};
    for (const tk of items) {
      const slug = tk.slug as string;
      const version = tk.meta?.version as string;
      if (slug && version) {
        versions[slug] = version;
      }
    }
    _toolkitVersions = versions;
    return versions;
  } catch {
    // Fallback — return empty, caller should use dangerouslySkipVersionCheck
    _toolkitVersions = {};
    return {};
  }
}

/**
 * Gets the pinned version for a toolkit slug (e.g. "gmail" → "20260212_00").
 * Returns undefined if not resolved yet.
 */
export function getToolkitVersion(toolkitSlug: string): string | undefined {
  return _toolkitVersions?.[toolkitSlug];
}
