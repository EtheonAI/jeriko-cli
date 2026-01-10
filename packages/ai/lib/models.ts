import { createOpenAI } from "@ai-sdk/openai";
import { keys } from "../keys";

const openai = createOpenAI({
  apiKey: keys().OPENAI_API_KEY,
  // Note: 'compatibility: strict' is now the default in v5 and has been removed
});

export const models = {
  chat: openai("gpt-4o-mini"),
  embeddings: openai.embedding("text-embedding-3-small"),
};