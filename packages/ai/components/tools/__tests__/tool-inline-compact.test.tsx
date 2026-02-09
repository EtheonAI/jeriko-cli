// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { ToolInlineCompact } from "../renderers/tool-inline-compact";

describe("ToolInlineCompact", () => {
  describe("browser tools", () => {
    it("shows URL when navigating", () => {
      render(
        <ToolInlineCompact
          toolName="browser_navigate"
          state="input-available"
          input={{ url: "https://example.com" }}
        />
      );
      expect(screen.getByText(/example\.com/)).toBeInTheDocument();
    });

    it("shows done label with title on output-available", () => {
      render(
        <ToolInlineCompact
          toolName="browser_navigate"
          state="output-available"
          input={{ url: "https://example.com" }}
          output={{ title: "Example Domain", url: "https://example.com" }}
        />
      );
      expect(screen.getByText(/Example Domain/)).toBeInTheDocument();
    });
  });

  describe("shell tools", () => {
    it("shows command text", () => {
      render(
        <ToolInlineCompact
          toolName="shell_exec"
          state="input-available"
          input={{ command: "ls -la" }}
        />
      );
      expect(screen.getByText(/ls -la/)).toBeInTheDocument();
    });

    it("shows exit code on completion", () => {
      render(
        <ToolInlineCompact
          toolName="shell_exec"
          state="output-available"
          input={{ command: "ls -la" }}
          output={{ exit_code: 0 }}
        />
      );
      expect(screen.getByText(/Exit 0/)).toBeInTheDocument();
    });

    it("shows error exit code", () => {
      render(
        <ToolInlineCompact
          toolName="shell_exec"
          state="output-available"
          input={{ command: "false" }}
          output={{ exit_code: 1 }}
        />
      );
      expect(screen.getByText(/Exit 1/)).toBeInTheDocument();
    });
  });

  describe("file tools", () => {
    it("shows file path for file_read", () => {
      render(
        <ToolInlineCompact
          toolName="file_read"
          state="input-available"
          input={{ path: "/home/user/test.py" }}
        />
      );
      expect(screen.getByText(/test\.py/)).toBeInTheDocument();
    });

    it("shows line count on completion", () => {
      render(
        <ToolInlineCompact
          toolName="file_read"
          state="output-available"
          input={{ path: "/home/user/test.py" }}
          output={{ content: "line1\nline2\nline3", lines: 3 }}
        />
      );
      expect(screen.getByText(/3 lines/)).toBeInTheDocument();
    });
  });

  describe("search tools", () => {
    it("shows search query", () => {
      render(
        <ToolInlineCompact
          toolName="web_search"
          state="input-available"
          input={{ query: "React hooks tutorial" }}
        />
      );
      expect(screen.getByText(/React hooks tutorial/)).toBeInTheDocument();
    });

    it("shows result count on completion", () => {
      render(
        <ToolInlineCompact
          toolName="web_search"
          state="output-available"
          input={{ query: "test" }}
          output={{ results: [{}, {}, {}] }}
        />
      );
      expect(screen.getByText(/3 results/)).toBeInTheDocument();
    });
  });

  describe("state indicators", () => {
    it("shows spinner for input-streaming", () => {
      const { container } = render(
        <ToolInlineCompact
          toolName="shell_exec"
          state="input-streaming"
          input={{ command: "ls" }}
        />
      );
      // Spinner has animate-spin class
      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("shows error styling for output-error", () => {
      render(
        <ToolInlineCompact
          toolName="shell_exec"
          state="output-error"
          input={{ command: "bad" }}
        />
      );
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("shows denied styling for output-denied", () => {
      render(
        <ToolInlineCompact
          toolName="shell_exec"
          state="output-denied"
          input={{ command: "rm -rf /" }}
        />
      );
      expect(screen.getByText("Denied")).toBeInTheDocument();
    });
  });

  describe("unknown tools", () => {
    it("falls back to formatted tool name for unknown tools", () => {
      render(
        <ToolInlineCompact
          toolName="some_unknown_tool"
          state="output-available"
          input={{ foo: "bar" }}
        />
      );
      // Unknown tools show formatted name (some_unknown_tool → Some unknown tool)
      expect(screen.getByText("Some unknown tool")).toBeInTheDocument();
    });
  });
});
