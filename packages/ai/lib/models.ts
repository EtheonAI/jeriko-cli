import { createOpenAI } from "@ai-sdk/openai";
import { keys } from "../keys";

const openai = createOpenAI({
  apiKey: keys().OPENAI_API_KEY,
  // Note: 'compatibility: strict' is now the default in v5 and has been removed
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