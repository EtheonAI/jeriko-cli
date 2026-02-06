import { Composio } from "@composio/core";
import { requireEnv } from "@repo/service-utils";

let _client: Composio | null = null;

export function getComposioClient(): Composio {
  if (!_client) {
    const apiKey = requireEnv("COMPOSIO_API_KEY");
    _client = new Composio({ apiKey });
  }
  return _client;
}
