// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { renderHook, render, screen } from "@testing-library/react";
import { ToolRegistry, useToolRegistry } from "../tool-registry";
import type { ToolRendererProps } from "../tool-registry";

// The 33 canonical tool names matching agent tools_definitions.py
const CANONICAL_TOOLS = [
  // Search
  "web_search",
  // Code execution
  "code_execute",
  // Shell / Terminal
  "shell_exec",
  "shell_view",
  "shell_wait",
  "shell_write_to_process",
  "shell_kill_process",
  // File operations
  "file_read",
  "file_write",
  "file_str_replace",
  "file_find_in_content",
  "file_find_by_name",
  // Browser
  "browser_navigate",
  "browser_view",
  "browser_click",
  "browser_input",
  "browser_scroll_up",
  "browser_scroll_down",
  "browser_move_mouse",
  "browser_press_key",
  "browser_select_option",
  "browser_console_exec",
  "browser_console_view",
  "browser_screenshot",
  "browser_restart",
  // Image generation
  "generate_image",
  // Deployment
  "deploy_expose_port",
  "deploy_apply_deployment",
  // Planning
  "show_plan",
  // Communication
  "message_notify_user",
  "message_ask_user",
  // Scheduling & Analytics
  "schedule_recurring_task",
  "check_outcomes",
] as const;

describe("Tool Registry", () => {
  describe("defaultRenderers", () => {
    it("all 33 canonical tool names resolve to a renderer (not GenericTool)", () => {
      const { result } = renderHook(() => useToolRegistry(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ToolRegistry>{children}</ToolRegistry>
        ),
      });

      for (const toolName of CANONICAL_TOOLS) {
        const renderer = result.current.getRenderer(toolName);
        expect(renderer).toBeDefined();
        // The wildcard "*" maps to GenericTool — canonical tools should NOT be GenericTool
        const fallback = result.current.getRenderer("*");
        expect(renderer).not.toBe(fallback);
      }
    });

    it("unknown tool name → GenericTool (fallback)", () => {
      const { result } = renderHook(() => useToolRegistry(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ToolRegistry>{children}</ToolRegistry>
        ),
      });

      const unknownRenderer = result.current.getRenderer("nonexistent_tool");
      const fallback = result.current.getRenderer("*");
      expect(unknownRenderer).toBe(fallback);
    });

    it("empty string → GenericTool", () => {
      const { result } = renderHook(() => useToolRegistry(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ToolRegistry>{children}</ToolRegistry>
        ),
      });

      const renderer = result.current.getRenderer("");
      const fallback = result.current.getRenderer("*");
      expect(renderer).toBe(fallback);
    });
  });

  describe("useToolRegistry outside provider", () => {
    it("returns defaults with working getRenderer", () => {
      // Render hook WITHOUT ToolRegistry provider
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { result } = renderHook(() => useToolRegistry());

      // Should still work with defaults
      expect(result.current.renderers).toBeDefined();
      expect(typeof result.current.getRenderer).toBe("function");
      expect(typeof result.current.registerRenderer).toBe("function");

      // getRenderer should resolve canonical tools
      const renderer = result.current.getRenderer("web_search");
      expect(renderer).toBeDefined();

      // registerRenderer should warn
      result.current.registerRenderer("test", () => null);
      expect(consoleSpy).toHaveBeenCalledWith(
        "ToolRegistryProvider not found. Renderer not registered."
      );

      consoleSpy.mockRestore();
    });
  });

  describe("custom renderers", () => {
    it("custom renderer overrides default", () => {
      const CustomWebSearch = (props: ToolRendererProps) => (
        <div data-testid="custom-search">Custom</div>
      );

      const { result } = renderHook(() => useToolRegistry(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ToolRegistry customRenderers={{ web_search: CustomWebSearch }}>
            {children}
          </ToolRegistry>
        ),
      });

      const renderer = result.current.getRenderer("web_search");
      expect(renderer).toBe(CustomWebSearch);
    });

    it("custom renderers do not affect other tools", () => {
      const CustomTool = (props: ToolRendererProps) => <div>Custom</div>;

      const { result } = renderHook(() => useToolRegistry(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ToolRegistry customRenderers={{ my_custom_tool: CustomTool }}>
            {children}
          </ToolRegistry>
        ),
      });

      // Custom tool should resolve
      expect(result.current.getRenderer("my_custom_tool")).toBe(CustomTool);

      // Built-in tools should still work
      const shellRenderer = result.current.getRenderer("shell_exec");
      expect(shellRenderer).toBeDefined();
      expect(shellRenderer).not.toBe(CustomTool);
    });
  });

  describe("renderer categories", () => {
    it("all browser tools resolve to the same renderer", () => {
      const { result } = renderHook(() => useToolRegistry(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ToolRegistry>{children}</ToolRegistry>
        ),
      });

      const browserTools = CANONICAL_TOOLS.filter((t) =>
        t.startsWith("browser_")
      );
      const firstRenderer = result.current.getRenderer(browserTools[0]);
      for (const tool of browserTools.slice(1)) {
        expect(result.current.getRenderer(tool)).toBe(firstRenderer);
      }
    });

    it("all shell tools resolve to the same renderer", () => {
      const { result } = renderHook(() => useToolRegistry(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ToolRegistry>{children}</ToolRegistry>
        ),
      });

      const shellTools = CANONICAL_TOOLS.filter((t) =>
        t.startsWith("shell_")
      );
      const firstRenderer = result.current.getRenderer(shellTools[0]);
      for (const tool of shellTools.slice(1)) {
        expect(result.current.getRenderer(tool)).toBe(firstRenderer);
      }
    });

    it("all file tools resolve to the same renderer", () => {
      const { result } = renderHook(() => useToolRegistry(), {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ToolRegistry>{children}</ToolRegistry>
        ),
      });

      const fileTools = CANONICAL_TOOLS.filter((t) => t.startsWith("file_"));
      const firstRenderer = result.current.getRenderer(fileTools[0]);
      for (const tool of fileTools.slice(1)) {
        expect(result.current.getRenderer(tool)).toBe(firstRenderer);
      }
    });
  });
});
