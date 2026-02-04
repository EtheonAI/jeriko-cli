"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { ChatComposer, type ChatComposerRef, MessageItem } from "@repo/ai/components";
import type { UIMessage, MessagePart } from "@repo/ai/lib/types";
import type { ChatAttachment } from "@repo/ai/components/input/chat-composer";
import { ConnectionStatus } from "../[id]/components/connection-status";

// Demo messages
const DEMO_MESSAGES: UIMessage[] = [
  {
    id: "msg-0",
    role: "user",
    parts: [{ type: "text", text: "Create a comprehensive plan to build a new e-commerce website" }],
    createdAt: new Date(Date.now() - 360000),
  },
  {
    id: "msg-plan",
    role: "assistant",
    parts: [
      {
        type: "reasoning",
        text: "This is a complex project that requires careful planning. Let me break it down into phases and create a structured plan with all the necessary steps...",
        state: "done",
      },
      {
        type: "tool-plan",
        toolCallId: "tc-plan-1",
        title: "Project Planning",
        state: "output-available",
        input: {
          goal: "Build e-commerce website",
          phases: 4,
        },
        output: {
          plan: {
            title: "E-Commerce Website Development Plan",
            phases: [
              {
                name: "Discovery & Planning",
                status: "completed",
                tasks: ["Requirements gathering", "Tech stack selection", "Architecture design"],
              },
              {
                name: "Design Phase",
                status: "in-progress",
                tasks: ["UI/UX wireframes", "Component library", "Responsive layouts"],
              },
              {
                name: "Development",
                status: "pending",
                tasks: ["Frontend implementation", "Backend API", "Database setup", "Payment integration"],
              },
              {
                name: "Testing & Launch",
                status: "pending",
                tasks: ["Unit tests", "Integration tests", "Performance optimization", "Deployment"],
              },
            ],
          },
        },
      },
      {
        type: "tool-progress",
        toolCallId: "tc-progress-1",
        title: "Project Progress",
        state: "output-available",
        input: { trackingId: "proj-ecommerce" },
        output: {
          steps: [
            { step: 1, title: "Initialize project structure", status: "completed", duration: "2m" },
            { step: 2, title: "Set up development environment", status: "completed", duration: "5m" },
            { step: 3, title: "Create database schema", status: "completed", duration: "8m" },
            { step: 4, title: "Implement authentication", status: "in-progress", progress: 65 },
            { step: 5, title: "Build product catalog", status: "pending" },
            { step: 6, title: "Create shopping cart", status: "pending" },
            { step: 7, title: "Integrate payment gateway", status: "pending" },
            { step: 8, title: "Deploy to production", status: "pending" },
          ],
          overallProgress: 42,
          estimatedCompletion: "2 hours",
        },
      },
      {
        type: "text",
        text: "I've created a comprehensive plan for building your e-commerce website. The project is broken down into 4 main phases with 8 key implementation steps.\n\n**Current Progress: 42%**\n\nWe've completed the initial setup and are now working on authentication. Would you like me to proceed with the next steps?",
        state: "done",
      },
    ],
    metadata: { model: "claude-3-opus" },
    createdAt: new Date(Date.now() - 330000),
  },
  {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: "Help me research the latest AI trends." }],
    createdAt: new Date(Date.now() - 300000),
  },
  {
    id: "msg-2",
    role: "assistant",
    parts: [
      {
        type: "reasoning",
        text: "The user wants me to research AI trends. I should search the web for recent AI news and analyze the findings.",
        state: "done",
      },
      {
        type: "text",
        text: "I'll help you research the latest AI trends. Let me search for recent developments.",
        state: "done",
      },
      {
        type: "tool-web_search",
        toolCallId: "tc-1",
        title: "Searching for AI trends 2024",
        state: "output-available",
        input: { query: "latest AI trends 2024 machine learning developments" },
        output: {
          results: [
            { title: "OpenAI Announces GPT-5", url: "https://example.com/1", snippet: "Major breakthrough in reasoning capabilities..." },
            { title: "Google DeepMind's Gemini 2.0", url: "https://example.com/2", snippet: "Multimodal AI reaches new heights..." },
            { title: "AI Agents Revolution", url: "https://example.com/3", snippet: "Autonomous agents transforming workflows..." },
          ],
        },
      },
      {
        type: "text",
        text: "Based on my research, here are the key AI trends:\n\n## 1. Advanced Reasoning Models\nNew models show significant improvements in logical reasoning.\n\n## 2. AI Agents\nAutonomous AI agents are becoming mainstream.\n\n## 3. Multimodal AI\nModels that work with text, images, video, and audio are now standard.",
        state: "done",
      },
    ],
    metadata: { model: "claude-3-opus" },
    createdAt: new Date(Date.now() - 240000),
  },
  {
    id: "msg-3",
    role: "user",
    parts: [{ type: "text", text: "Can you write Python code to analyze sentiment?" }],
    createdAt: new Date(Date.now() - 180000),
  },
  {
    id: "msg-4",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "I'll create a sentiment analysis script for you:",
        state: "done",
      },
      {
        type: "tool-code_interpreter",
        toolCallId: "tc-2",
        title: "Writing sentiment analysis code",
        state: "output-available",
        input: {
          language: "python",
          code: `from textblob import TextBlob

def analyze_sentiment(text):
    blob = TextBlob(text)
    return {
        'polarity': blob.sentiment.polarity,
        'sentiment': 'positive' if blob.sentiment.polarity > 0 else 'negative'
    }

print(analyze_sentiment("I love this!"))`,
        },
        output: {
          stdout: "{'polarity': 0.625, 'sentiment': 'positive'}",
          exitCode: 0,
        },
      },
      {
        type: "text",
        text: "The code uses TextBlob for sentiment analysis. Polarity ranges from -1 (negative) to 1 (positive).",
        state: "done",
      },
    ],
    metadata: { model: "claude-3-opus" },
    createdAt: new Date(Date.now() - 120000),
  },
];

export function DemoChatClient() {
  const composerRef = React.useRef<ChatComposerRef>(null);
  const [messages, setMessages] = useState<UIMessage[]>(DEMO_MESSAGES);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSendMessage = useCallback(
    (parts: MessagePart[], files?: ChatAttachment[]) => {
      const textPart = parts.find((p) => p.type === "text") as { type: "text"; text: string } | undefined;
      if (!textPart?.text.trim()) return;

      const userMessage: UIMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: textPart.text }],
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      setTimeout(() => {
        const assistantMessage: UIMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `Demo response to: "${textPart.text}"`,
              state: "done",
            },
          ],
          metadata: { model: "demo" },
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsStreaming(false);
      }, 1000);
    },
    []
  );

  const handleToolApproval = useCallback((toolCallId: string, approved: boolean) => {
    setMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) =>
          "toolCallId" in part && part.toolCallId === toolCallId
            ? { ...part, state: approved ? "output-available" : "output-denied" }
            : part
        ),
      }))
    );
  }, []);

  const handleMessageAction = useCallback((action: string, messageId: string) => {
    console.log(`Action: ${action} on ${messageId}`);
  }, []);

  console.log("Rendering with", messages.length, "messages");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", backgroundColor: "var(--background)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <h1 style={{ fontSize: "16px", fontWeight: 600 }}>Demo Chat</h1>
          <ConnectionStatus isConnected={true} />
          <span style={{ background: "rgba(234, 179, 8, 0.2)", color: "#eab308", padding: "4px 12px", borderRadius: "9999px", fontSize: "12px" }}>
            Demo Mode
          </span>
        </div>
        <div style={{ fontSize: "14px", color: "var(--muted-foreground)" }}>
          {messages.length} messages
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: "768px", margin: "0 auto", padding: "24px 16px" }}>
          {messages.map((message) => (
            <div key={message.id} style={{ marginBottom: "16px" }}>
              <MessageItem
                message={message}
                onAction={handleMessageAction}
                onToolApproval={handleToolApproval}
              />
            </div>
          ))}
          {isStreaming && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center", color: "var(--muted-foreground)", fontSize: "14px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--primary)", animation: "pulse 2s infinite" }} />
              Typing...
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "16px", flexShrink: 0 }}>
        <div style={{ maxWidth: "768px", margin: "0 auto" }}>
          <ChatComposer
            ref={composerRef}
            onSubmit={handleSendMessage}
            onCancel={() => setIsStreaming(false)}
            isLoading={false}
            isStreaming={isStreaming}
            placeholder="Type a message (demo mode)..."
          />
        </div>
      </div>
    </div>
  );
}