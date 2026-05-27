/**
 * E2B Adapter Tests
 *
 * Tests for E2B adapter interface and implementation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { E2BSdkAdapter } from "../lib/adapters/e2b-sdk-adapter.js";
import { E2BAdapterFactory } from "../lib/adapters/adapter-factory.js";
import type { IE2BAdapter } from "../lib/adapters/e2b-adapter.interface.js";

describe("E2B Adapter Interface", () => {
  let adapter: IE2BAdapter;

  beforeEach(() => {
    adapter = new E2BSdkAdapter();
  });

  describe("Adapter Factory", () => {
    it("should create E2B SDK adapter when feature flag is enabled", () => {
      const factory = E2BAdapterFactory.create({
        enableE2BAdapter: true,
        sandboxConfig: {
          apiKey: "test-key",
        },
      });

      expect(factory).toBeInstanceOf(E2BSdkAdapter);
    });

    it("should create default adapter when feature flag is disabled", () => {
      const factory = E2BAdapterFactory.create({
        enableE2BAdapter: false,
        sandboxConfig: {
          apiKey: "test-key",
        },
      });

      expect(factory).toBeInstanceOf(E2BSdkAdapter);
    });

    it("should create explicit adapter type", () => {
      const factory = E2BAdapterFactory.createExplicit("e2b-sdk");
      expect(factory).toBeInstanceOf(E2BSdkAdapter);
    });
  });

  describe("Adapter Interface Compliance", () => {
    it("should implement create method", () => {
      expect(adapter.create).toBeDefined();
      expect(typeof adapter.create).toBe("function");
    });

    it("should implement connect method", () => {
      expect(adapter.connect).toBeDefined();
      expect(typeof adapter.connect).toBe("function");
    });

    it("should implement executeCode method", () => {
      expect(adapter.executeCode).toBeDefined();
      expect(typeof adapter.executeCode).toBe("function");
    });

    it("should implement executeShell method", () => {
      expect(adapter.executeShell).toBeDefined();
      expect(typeof adapter.executeShell).toBe("function");
    });

    it("should implement executeBrowserAction method", () => {
      expect(adapter.executeBrowserAction).toBeDefined();
      expect(typeof adapter.executeBrowserAction).toBe("function");
    });

    it("should implement writeFile method", () => {
      expect(adapter.writeFile).toBeDefined();
      expect(typeof adapter.writeFile).toBe("function");
    });

    it("should implement readFile method", () => {
      expect(adapter.readFile).toBeDefined();
      expect(typeof adapter.readFile).toBe("function");
    });

    it("should implement listFiles method", () => {
      expect(adapter.listFiles).toBeDefined();
      expect(typeof adapter.listFiles).toBe("function");
    });

    it("should implement destroy method", () => {
      expect(adapter.destroy).toBeDefined();
      expect(typeof adapter.destroy).toBe("function");
    });

    it("should implement isActive method", () => {
      expect(adapter.isActive).toBeDefined();
      expect(typeof adapter.isActive).toBe("function");
    });

    it("should implement getStatus method", () => {
      expect(adapter.getStatus).toBeDefined();
      expect(typeof adapter.getStatus).toBe("function");
    });
  });

  describe("Adapter Error Handling", () => {
    it("should throw error when executing code on non-existent sandbox", async () => {
      await expect(
        adapter.executeCode("non-existent-id", 'print("test")', "python")
      ).rejects.toThrow();
    });

    it("should throw error when connecting to invalid sandbox", async () => {
      await expect(adapter.connect("invalid-sandbox-id")).rejects.toThrow();
    });

    it("should return false for isActive on non-existent sandbox", async () => {
      const isActive = await adapter.isActive("non-existent-id");
      expect(isActive).toBe(false);
    });

    it("should return stopped status for non-existent sandbox", async () => {
      const status = await adapter.getStatus("non-existent-id");
      expect(status).toBe("stopped");
    });
  });
});
