// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { ToolInlineCompact } from "../renderers/tool-inline-compact";

describe("ToolInlineCompact", () => {
  describe("browser tools", () => {
    it("shows URL hostname when navigating", () => {
      render(
        <ToolInlineCompact
          toolName="browser_navigate"
          state="input-available"
          input={{ url: "https://example.com" }}
        />
      );
      expect(screen.getByText(/example\.com/)).toBeInTheDocument();
    });

    it("keeps same label on output-available (Manus-style — no state change)", () => {
      render(
        <ToolInlineCompact
          toolName="browser_navigate"
          state="output-available"
          input={{ url: "https://example.com" }}
          output={{ title: "Example Domain", url: "https://example.com" }}
        />
      );
      // Same hostname label shown regardless of state
      const labels = screen.getAllByText(/example\.com/);
      expect(labels.length).toBeGreaterThan(0);
    });

    it("shows descriptive label for browser_click", () => {
      render(
        <ToolInlineCompact
          toolName="browser_click"
          state="input-available"
          input={{ description: "News section link" }}
        />
      );
      expect(screen.getByText(/News section link/)).toBeInTheDocument();
    });

    it("shows screenshot label", () => {
      render(
        <ToolInlineCompact
          toolName="browser_screenshot"
          state="output-available"
          input={{}}
        />
      );
      expect(screen.getByText("Capturing screenshot")).toBeInTheDocument();
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

    it("keeps command label on completion (Manus-style)", () => {
      render(
        <ToolInlineCompact
          toolName="shell_exec"
          state="output-available"
          input={{ command: "ls -la" }}
          output={{ exit_code: 0 }}
        />
      );
      // Label contains the command
      const labels = screen.getAllByText(/ls -la/);
      expect(labels.length).toBeGreaterThan(0);
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

    it("shows file_write with creating label", () => {
      render(
        <ToolInlineCompact
          toolName="file_write"
          state="output-available"
          input={{ path: "/home/user/index.html" }}
        />
      );
      expect(screen.getByText(/index\.html/)).toBeInTheDocument();
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

    it("keeps query label on completion (Manus-style)", () => {
      render(
        <ToolInlineCompact
          toolName="web_search"
          state="output-available"
          input={{ query: "test query" }}
          output={{ results: [{}, {}, {}] }}
        />
      );
      expect(screen.getByText(/test query/)).toBeInTheDocument();
    });
  });

  describe("state indicators", () => {
    it("shows pulse dot for input-streaming (active state)", () => {
      const { container } = render(
        <ToolInlineCompact
          toolName="browser_view"
          state="input-streaming"
          input={{}}
        />
      );
      // Active state shows pulse dot with animate-ping
      const pulse = container.querySelector(".animate-ping");
      expect(pulse).toBeInTheDocument();
    });

    it("shows pulse dot for input-available (active state)", () => {
      const { container } = render(
        <ToolInlineCompact
          toolName="browser_view"
          state="input-available"
          input={{}}
        />
      );
      const pulse = container.querySelector(".animate-ping");
      expect(pulse).toBeInTheDocument();
    });

    it("no pulse dot for completed state", () => {
      const { container } = render(
        <ToolInlineCompact
          toolName="browser_view"
          state="output-available"
          input={{}}
        />
      );
      const pulse = container.querySelector(".animate-ping");
      expect(pulse).not.toBeInTheDocument();
    });
  });

  describe("Manus-style pill styling", () => {
    it("has rounded-[15px] pill shape", () => {
      const { container } = render(
        <ToolInlineCompact
          toolName="browser_navigate"
          state="output-available"
          input={{ url: "https://example.com" }}
        />
      );
      const pill = container.querySelector(".rounded-\\[15px\\]");
      expect(pill).toBeInTheDocument();
    });

    it("has h-7 height", () => {
      const { container } = render(
        <ToolInlineCompact
          toolName="browser_navigate"
          state="output-available"
          input={{ url: "https://example.com" }}
        />
      );
      const heightContainer = container.querySelector(".h-7");
      expect(heightContainer).toBeInTheDocument();
    });

    it("has tooltip with full details", () => {
      render(
        <ToolInlineCompact
          toolName="browser_navigate"
          state="output-available"
          input={{ url: "https://www.yahoo.com/finance" }}
        />
      );
      const pill = screen.getByTitle("Browsing: https://www.yahoo.com/finance");
      expect(pill).toBeInTheDocument();
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
      expect(screen.getByText("Some unknown tool")).toBeInTheDocument();
    });
  });
});
