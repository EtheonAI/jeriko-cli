import "server-only";
import Typesense from "typesense";
import type Client from "typesense/lib/Typesense/Client";
import { env } from "./env";

// Singleton pattern for Typesense client
let typesenseClient: Client | null = null;

export function getTypesenseClient(): Client {
  if (!typesenseClient) {
    typesenseClient = new Typesense.Client({
      nodes: [
        {
          host: env.TYPESENSE_HOST,
          port: env.TYPESENSE_PORT,
          protocol: env.TYPESENSE_PROTOCOL,
        },
      ],
      apiKey: env.TYPESENSE_API_KEY,
      connectionTimeoutSeconds: 5,
      retryIntervalSeconds: 0.1,
      numRetries: 3,
    });
  }
  return typesenseClient;
}

// Health check function
export async function checkTypesenseHealth(): Promise<boolean> {
  try {
    const client = getTypesenseClient();
    const health = await client.health.retrieve();
    return health.ok === true;
  } catch {
    return false;
  }
}

// Export for testing purposes
export function resetTypesenseClient(): void {
  typesenseClient = null;
}
