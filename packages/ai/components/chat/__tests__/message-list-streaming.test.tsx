// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { MessageList } from "../message-list";

// Minimal UIMessage shape for testing
function makeMessage(overrides: Partial<{
  id: string;
  role: string;
  content: string;
  parts: Array<{ type: string; text?: string }>;
}>): any {
  return {
    id: overrides.id ?? "msg-1",
    role: overrides.role ?? "user",
    content: overrides.content ?? "Hello",
    parts: overrides.parts ?? [{ type: "text", text: "Hello" }],
    createdAt: new Date(),
    ...overrides,
  };
}

describe("MessageList streaming indicator", () => {
  it("shows thinking indicator when streaming with no messages", () => {
    render(<MessageList messages={[]} isStreaming={true} />);
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("shows thinking indicator when last message is from user (submitted state)", () => {
    const messages = [makeMessage({ id: "m1", role: "user" })];
    render(<MessageList messages={messages} isStreaming={true} />);
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("shows thinking indicator when assistant message has no parts", () => {
    const messages = [
      makeMessage({ id: "m1", role: "user" }),
      makeMessage({ id: "m2", role: "assistant", parts: [] }),
    ];
    render(<MessageList messages={messages} isStreaming={true} />);
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("does NOT show thinking indicator when assistant has parts", () => {
    const messages = [
      makeMessage({ id: "m1", role: "user" }),
      makeMessage({ id: "m2", role: "assistant", parts: [{ type: "text", text: "Response" }] }),
    ];
    render(<MessageList messages={messages} isStreaming={true} />);
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("does NOT show thinking indicator when not streaming", () => {
    const messages = [makeMessage({ id: "m1", role: "user" })];
    render(<MessageList messages={messages} isStreaming={false} />);
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("shows empty state when no messages and not streaming", () => {
    render(
      <MessageList
        messages={[]}
        isStreaming={false}
        emptyState={<div>No messages yet</div>}
      />
    );
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });
});
