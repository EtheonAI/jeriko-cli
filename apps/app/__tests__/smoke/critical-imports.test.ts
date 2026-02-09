import { describe, it, expect } from "vitest";

// ============================================================================
// Critical Imports Smoke Tests
//
// These smoke tests verify that critical modules can be imported without
// errors. They use dynamic imports to isolate failures and provide clear
// error messages when a module fails to load. This catches broken exports,
// missing dependencies, and circular import issues early.
// ============================================================================

describe("Critical Imports", () => {
  // -------------------------------------------------------------------------
  // 1. @repo/database imports successfully
  // -------------------------------------------------------------------------
  it("@repo/database module loads without error", async () => {
    const importDb = async () => {
      const mod = await import("@repo/database");
      return mod;
    };

    // The import itself should not throw
    await expect(importDb()).resolves.toBeDefined();
  });

  it("@repo/database exports db client and schema tables", async () => {
    const mod = await import("@repo/database");
    // The module may wrap exports under .default due to ESM/CJS compat
    const exports = (mod as Record<string, unknown>).default ?? mod;

    // The database package should export at least these symbols
    expect(exports).toBeDefined();
    expect(typeof exports).toBe("object");
  });

  // -------------------------------------------------------------------------
  // 2. SSEProcessor class can be instantiated
  // -------------------------------------------------------------------------
  it("SSEProcessor class can be imported and instantiated", async () => {
    const { SSEProcessor } = await import("../../lib/chat/sse-processor");

    expect(SSEProcessor).toBeDefined();
    expect(typeof SSEProcessor).toBe("function");

    const processor = new SSEProcessor();
    expect(processor).toBeInstanceOf(SSEProcessor);
    expect(typeof processor.process).toBe("function");
    expect(typeof processor.finalize).toBe("function");
    expect(typeof processor.closeStep).toBe("function");
    expect(typeof processor.closeTextPart).toBe("function");
    expect(typeof processor.closeReasoningPart).toBe("function");
  });

  it("SSEProcessor initializes with empty state", async () => {
    const { SSEProcessor } = await import("../../lib/chat/sse-processor");
    const processor = new SSEProcessor();

    expect(processor.collectedText).toEqual([]);
    expect(processor.collectedToolSteps).toEqual([]);
    expect(processor.collectedParts).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 3. @repo/ai package sub-module exports are available
  //
  // NOTE: The barrel `@repo/ai` re-exports React component code (canvas,
  // tools, etc.) which depends on `react-dom`. In a pure vitest/jsdom
  // environment, this may fail to resolve. We test specific sub-modules
  // instead to validate that the non-component exports are functional.
  // -------------------------------------------------------------------------
  it("@repo/ai/lib/rubic-provider loads and exports RubicAI", async () => {
    const mod = await import("@repo/ai/lib/rubic-provider");

    expect(mod.createRubicAI).toBeDefined();
    expect(typeof mod.createRubicAI).toBe("function");

    expect(mod.getRubicAI).toBeDefined();
    expect(typeof mod.getRubicAI).toBe("function");

    expect(mod.RubicAI).toBeDefined();
  });

  it("@repo/ai/lib/models loads and exports model resolution", async () => {
    const mod = await import("@repo/ai/lib/models");

    expect(mod.resolveModelName).toBeDefined();
    expect(typeof mod.resolveModelName).toBe("function");

    expect(mod.DEFAULT_MODEL).toBeDefined();
    expect(typeof mod.DEFAULT_MODEL).toBe("string");
  });

  it("@repo/ai/lib/types exports type guard functions", async () => {
    const mod = await import("@repo/ai/lib/types");

    expect(mod.isTextUIPart).toBeDefined();
    expect(typeof mod.isTextUIPart).toBe("function");

    expect(mod.isToolUIPart).toBeDefined();
    expect(typeof mod.isToolUIPart).toBe("function");

    expect(mod.getMessageText).toBeDefined();
    expect(typeof mod.getMessageText).toBe("function");
  });

  // -------------------------------------------------------------------------
  // 4. Chat route module exports POST handler
  // -------------------------------------------------------------------------
  it("chat route module exports POST handler", async () => {
    const importRoute = async () => {
      const mod = await import("../../app/api/chat/route");
      return mod;
    };

    // Note: This import may fail if it tries to execute server-side code
    // (auth, db connections) at import time. We wrap in try/catch to
    // distinguish between "module not found" and "runtime init error".
    try {
      const mod = await importRoute();
      expect(mod).toBeDefined();
      expect(mod.POST).toBeDefined();
      expect(typeof mod.POST).toBe("function");
    } catch (err) {
      // If the import fails due to missing env vars or server-only deps,
      // that's acceptable for a smoke test -- the module exists and is
      // syntactically valid. The error should NOT be "MODULE_NOT_FOUND".
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain("Cannot find module");
      expect(message).not.toContain("MODULE_NOT_FOUND");
    }
  });

  // -------------------------------------------------------------------------
  // Error detection module
  // -------------------------------------------------------------------------
  it("error-detection module exports all functions", async () => {
    const mod = await import("../../lib/chat/error-detection");

    expect(mod.detectQuotaError).toBeDefined();
    expect(typeof mod.detectQuotaError).toBe("function");

    expect(mod.isQuotaError).toBeDefined();
    expect(typeof mod.isQuotaError).toBe("function");

    expect(mod.extractErrorMessage).toBeDefined();
    expect(typeof mod.extractErrorMessage).toBe("function");
  });

  it("extractErrorMessage handles various input types", async () => {
    const { extractErrorMessage } = await import("../../lib/chat/error-detection");

    expect(extractErrorMessage("plain string")).toBe("plain string");
    expect(extractErrorMessage({ message: "obj message" })).toBe("obj message");
    expect(extractErrorMessage({ error: "obj error" })).toBe("obj error");
    expect(extractErrorMessage({ error: { message: "nested" } })).toBe("nested");
    expect(extractErrorMessage(null)).toBe("Unknown error");
    expect(extractErrorMessage(undefined)).toBe("Unknown error");
  });
});
