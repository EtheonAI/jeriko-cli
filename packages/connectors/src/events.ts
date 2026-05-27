import { type ConnectorEvent, connectorEventSchema } from "./contracts.js";
import { asRecord, readDate, readNestedRecord, readString } from "./internal.js";

export function normalizeComposioEvent(input: unknown): ConnectorEvent {
  const payload = asRecord(input);
  const metadata = readNestedRecord(payload, ["metadata", "meta"]);
  const trigger = readNestedRecord(payload, ["trigger"]);
  const connectedAccount = readNestedRecord(payload, ["connectedAccount", "connected_account"]);

  return connectorEventSchema.parse({
    provider: "composio",
    id:
      readString(payload, ["id", "eventId", "event_id"]) ??
      readString(metadata, ["id", "eventId", "event_id", "logId", "log_id"]),
    type:
      readString(payload, ["type", "event", "eventType", "event_type"]) ??
      readString(metadata, ["type", "event", "eventType", "event_type"]) ??
      "composio.trigger.message",
    occurredAt:
      readDate(payload, ["createdAt", "created_at", "timestamp"]) ??
      readDate(metadata, ["createdAt", "created_at", "timestamp"]),
    toolkitSlug:
      readString(payload, ["toolkitSlug", "toolkit_slug"]) ??
      readString(metadata, ["toolkitSlug", "toolkit_slug"]) ??
      readString(trigger, ["toolkitSlug", "toolkit_slug"]),
    triggerSlug:
      readString(payload, ["triggerSlug", "trigger_slug", "triggerName"]) ??
      readString(metadata, ["triggerSlug", "trigger_slug", "triggerName"]) ??
      readString(trigger, ["slug", "triggerSlug", "trigger_slug", "triggerName"]),
    connectedAccountId:
      readString(payload, ["connectedAccountId", "connected_account_id"]) ??
      readString(metadata, ["connectedAccountId", "connected_account_id"]) ??
      readString(connectedAccount, ["id", "nanoId", "nanoid"]),
    payload: input,
    metadata,
  });
}
