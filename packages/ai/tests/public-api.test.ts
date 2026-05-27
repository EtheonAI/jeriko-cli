import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DefaultChatTransport,
  ToolLoopAgent,
  convertFileListToFileUIParts,
  convertToModelMessages,
  createDownload,
  createProviderRegistry,
  createUIMessageStreamResponse,
  embed,
  embedMany,
  experimental_transcribe,
  generateImage,
  gateway,
  Output,
  registerTelemetryIntegration,
  rerank,
  safeValidateUIMessages,
  simulateReadableStream,
  streamText,
  tool,
  wrapLanguageModel,
} from "../src/index.js";
import { getAllToolDefinitions } from "../src/tools/index.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe("@repo/ai public API", () => {
  it("exposes the AI SDK features the platform plans to use", () => {
    expect(typeof DefaultChatTransport).toBe("function");
    expect(typeof ToolLoopAgent).toBe("function");
    expect(typeof convertFileListToFileUIParts).toBe("function");
    expect(typeof convertToModelMessages).toBe("function");
    expect(typeof createDownload).toBe("function");
    expect(typeof createProviderRegistry).toBe("function");
    expect(typeof createUIMessageStreamResponse).toBe("function");
    expect(typeof embed).toBe("function");
    expect(typeof embedMany).toBe("function");
    expect(typeof experimental_transcribe).toBe("function");
    expect(typeof generateImage).toBe("function");
    expect(typeof gateway).toBe("function");
    expect(typeof Output.object).toBe("function");
    expect(typeof Output.array).toBe("function");
    expect(typeof registerTelemetryIntegration).toBe("function");
    expect(typeof rerank).toBe("function");
    expect(typeof safeValidateUIMessages).toBe("function");
    expect(typeof simulateReadableStream).toBe("function");
    expect(typeof streamText).toBe("function");
    expect(typeof tool).toBe("function");
    expect(typeof wrapLanguageModel).toBe("function");
  });

  it("keeps schema-only platform tools available through the package", () => {
    const tools = getAllToolDefinitions();

    expect(tools).toHaveProperty("message_ask_user");
    expect(tools).toHaveProperty("info_search_web");
    expect(tools).toHaveProperty("code_execute");
  });

  it("does not depend on React UI or third-party assistant UI packages", async () => {
    const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const forbiddenPackages = [
      ["@assistant", "ui/react"].join("-"),
      "@ai-sdk/react",
      "react",
      "react-dom",
    ];

    for (const packageName of forbiddenPackages) {
      expect(dependencies).not.toHaveProperty(packageName);
    }
  });
});
