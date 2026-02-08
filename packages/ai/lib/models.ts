import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { keys } from "../keys";

const openai = createOpenAI({
  apiKey: keys().OPENAI_API_KEY,
  // Note: 'compatibility: strict' is now the default in v5 and has been removed
});

const anthropic = createAnthropic({
  apiKey: keys().ANTHROPIC_API_KEY,
});

/**
 * Chat and embedding models for the AI package.
 *
 * Note: We use explicit type assertions here to avoid TypeScript's
 * cross-package type inference issues with pnpm's node_modules structure.
 * Consumers should use these with the Vercel AI SDK functions which
 * will properly type-check the models.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const models: Record<string, any> = {
  chat: openai("gpt-4o-mini"),
  embeddings: openai.embedding("text-embedding-3-small"),
};

/** Get the chat model */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getChatModel(): any {
  return openai("gpt-4o-mini");
}

/** Get a custom chat model by name */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getModel(modelName: string): any {
  return openai(modelName);
}

/** Get the embeddings model */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEmbeddingsModel(): any {
  return openai.embedding("text-embedding-3-small");
}

/** Resolve a model by ID, supporting both OpenAI and Anthropic */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveModel(modelId?: string): any {
  if (!modelId) {
    return openai("gpt-4o-mini");
  }
  if (modelId.startsWith("claude")) {
    return anthropic(modelId);
  }
  return openai(modelId);
}

/** Resolve a fallback model when the primary provider has a quota/auth error */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveFallbackModel(primaryModelId?: string): any {
  // If primary was OpenAI (or default), fall back to Anthropic
  if (!primaryModelId || !primaryModelId.startsWith("claude")) {
    return anthropic("claude-sonnet-4-5-20250929");
  }
  // If primary was Anthropic, fall back to OpenAI
  return openai("gpt-4o-mini");
}
