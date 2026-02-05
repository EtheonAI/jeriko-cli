import { AgentMailClient, AgentMail } from "agentmail";
import { keys } from "./keys";

export { keys } from "./keys";

let _client: AgentMailClient | null = null;

function getClient(): AgentMailClient {
  if (!_client) {
    const env = keys();
    _client = new AgentMailClient({
      apiKey: env.AGENTMAIL_API_KEY,
    });
  }
  return _client;
}

/** Create a new inbox */
export async function createInbox(opts?: { displayName?: string }) {
  const client = getClient();
  return client.inboxes.create(opts?.displayName ? { displayName: opts.displayName } : undefined);
}

/** Get an inbox by ID */
export async function getInbox(inboxId: string) {
  const client = getClient();
  return client.inboxes.get(inboxId);
}

/** Update an inbox */
export async function updateInbox(inboxId: string, data: { displayName?: string }) {
  const client = getClient();
  return client.inboxes.update(inboxId, {
    displayName: data.displayName ?? "",
  });
}

/** Delete an inbox */
export async function deleteInbox(inboxId: string) {
  const client = getClient();
  return client.inboxes.delete(inboxId);
}

/** List messages in an inbox */
export async function listMessages(inboxId: string, opts?: { limit?: number; pageToken?: string }) {
  const client = getClient();
  return client.inboxes.messages.list(inboxId, opts);
}

/** Get a single message */
export async function getMessage(inboxId: string, messageId: string) {
  const client = getClient();
  return client.inboxes.messages.get(inboxId, messageId);
}

/** Send a message from an inbox */
export async function sendMessage(
  inboxId: string,
  data: { to: string; subject: string; text: string }
) {
  const client = getClient();
  return client.inboxes.messages.send(inboxId, {
    to: [data.to],
    subject: data.subject,
    text: data.text,
  });
}

/** Reply to a message */
export async function replyToMessage(inboxId: string, messageId: string, data: { text: string }) {
  const client = getClient();
  return client.inboxes.messages.reply(inboxId, messageId, {
    text: data.text,
  });
}

/** Forward a message */
export async function forwardMessage(inboxId: string, messageId: string, data: { to: string }) {
  const client = getClient();
  return client.inboxes.messages.forward(inboxId, messageId, {
    to: [data.to],
  });
}

/** List threads in an inbox */
export async function listThreads(inboxId: string, opts?: { limit?: number; pageToken?: string }) {
  const client = getClient();
  return client.inboxes.threads.list(inboxId, opts);
}

/** Get a single thread */
export async function getThread(inboxId: string, threadId: string) {
  const client = getClient();
  return client.inboxes.threads.get(inboxId, threadId);
}

/** Create a webhook */
export async function createWebhook(data: { url: string; eventTypes: AgentMail.EventType[] }) {
  const client = getClient();
  return client.webhooks.create({
    url: data.url,
    eventTypes: data.eventTypes,
  });
}
