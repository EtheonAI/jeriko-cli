"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import {
  ChatContainer,
  MessageList,
  ChatComposer,
  AgentDagPanel,
  type ChatComposerRef,
  type AgentData,
} from "@repo/ai/components";
import type { UIMessage, UIMessagePart, MessagePart } from "@repo/ai/lib/types";
import type { ChatAttachment } from "@repo/ai/components/input/chat-composer";
import { ConnectionStatus } from "../[id]/components/connection-status";

// Demo messages showcasing all features
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
    parts: [{ type: "text", text: "Help me research the latest AI trends and create a summary report." }],
    createdAt: new Date(Date.now() - 300000),
  },
  {
    id: "msg-2",
    role: "assistant",
    parts: [
      {
        type: "reasoning",
        text: "The user wants me to research AI trends. I should:\n1. Search the web for recent AI news\n2. Analyze the findings\n3. Create a structured summary\n\nLet me start by searching for the latest AI developments...",
        state: "done",
      },
      {
        type: "text",
        text: "I'll help you research the latest AI trends. Let me search for recent developments and compile a summary for you.",
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
        type: "source-url",
        sourceId: "src-1",
        url: "https://example.com/ai-trends",
        title: "AI Trends Report 2024",
      },
      { type: "step-start" },
      {
        type: "text",
        text: "Based on my research, here are the key AI trends:\n\n## 1. Advanced Reasoning Models\nNew models like GPT-5 and Gemini 2.0 show significant improvements in logical reasoning and multi-step problem solving.\n\n## 2. AI Agents\nAutonomous AI agents that can browse the web, write code, and complete complex tasks are becoming mainstream.\n\n## 3. Multimodal AI\nModels that can seamlessly work with text, images, video, and audio are now standard.",
        state: "done",
      },
    ],
    metadata: { model: "claude-3-opus" },
    createdAt: new Date(Date.now() - 240000),
  },
  {
    id: "msg-3",
    role: "user",
    parts: [{ type: "text", text: "Can you write some Python code to analyze sentiment in text?" }],
    createdAt: new Date(Date.now() - 180000),
  },
  {
    id: "msg-4",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "I'll create a sentiment analysis script for you. Let me write the code:",
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
import pandas as pd

def analyze_sentiment(text):
    """
    Analyze the sentiment of given text.
    Returns polarity (-1 to 1) and subjectivity (0 to 1).
    """
    blob = TextBlob(text)
    return {
        'text': text[:50] + '...' if len(text) > 50 else text,
        'polarity': round(blob.sentiment.polarity, 3),
        'subjectivity': round(blob.sentiment.subjectivity, 3),
        'sentiment': 'positive' if blob.sentiment.polarity > 0
                     else 'negative' if blob.sentiment.polarity < 0
                     else 'neutral'
    }

# Example usage
sample_texts = [
    "I absolutely love this product! It's amazing!",
    "This is the worst experience I've ever had.",
    "The weather today is okay, nothing special."
]

results = [analyze_sentiment(text) for text in sample_texts]
df = pd.DataFrame(results)
print(df.to_string(index=False))`,
        },
        output: {
          stdout: `                                              text  polarity  subjectivity sentiment
    I absolutely love this product! It's amazi...     0.625         0.600  positive
    This is the worst experience I've ever had.    -1.000         1.000  negative
             The weather today is okay, nothing s...     0.500         1.000  positive`,
          exitCode: 0,
        },
      },
      {
        type: "text",
        text: "The code above uses TextBlob for sentiment analysis. It returns:\n- **Polarity**: -1 (negative) to 1 (positive)\n- **Subjectivity**: 0 (objective) to 1 (subjective)\n\nYou can install the required packages with: `pip install textblob pandas`",
        state: "done",
      },
    ],
    metadata: { model: "claude-3-opus" },
    createdAt: new Date(Date.now() - 120000),
  },
  {
    id: "msg-5",
    role: "user",
    parts: [{ type: "text", text: "Run a shell command to check the system info" }],
    createdAt: new Date(Date.now() - 60000),
  },
  {
    id: "msg-6",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "I'll run a command to get your system information:",
        state: "done",
      },
      {
        type: "tool-shell_command",
        toolCallId: "tc-3",
        title: "Running system info command",
        state: "approval-requested",
        input: { command: "uname -a && df -h && free -m" },
        approval: { id: "approval-1" },
      },
    ],
    metadata: { model: "claude-3-opus" },
    createdAt: new Date(Date.now() - 30000),
  },
  {
    id: "msg-7",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Here's a file I found that might be relevant:",
        state: "done",
      },
      {
        type: "tool-file_read",
        toolCallId: "tc-4",
        title: "Reading configuration file",
        state: "output-available",
        input: { path: "/etc/config.json" },
        output: {
          content: `{
  "app_name": "Rubic AI",
  "version": "1.0.0",
  "features": {
    "multi_agent": true,
    "streaming": true,
    "tool_use": true
  }
}`,
          mimeType: "application/json",
        },
      },
    ],
    metadata: { model: "claude-3-opus" },
    createdAt: new Date(Date.now() - 15000),
  },
];

// Demo agents for DAG visualization
const DEMO_AGENTS: AgentData[] = [
  {
    id: "agent-1",
    type: "orchestrator" as const,
    name: "Orchestrator",
    status: "executing" as const,
    currentTask: "Coordinating agents",
    progress: 100,
    tasks: [
      { id: "t1", title: "Parse user request", description: "Analyze intent", status: "completed" as const },
      { id: "t2", title: "Assign to agents", description: "Route to specialists", status: "completed" as const },
      { id: "t3", title: "Aggregate results", description: "Combine outputs", status: "in_progress" as const },
    ],
  },
  {
    id: "agent-2",
    type: "researcher" as const,
    name: "Researcher",
    status: "executing" as const,
    currentTask: "Searching web",
    progress: 75,
    tasks: [
      { id: "t4", title: "Web search", description: "Find relevant sources", status: "completed" as const },
      { id: "t5", title: "Analyze content", description: "Extract key info", status: "in_progress" as const },
      { id: "t6", title: "Summarize findings", description: "Create summary", status: "pending" as const },
    ],
  },
  {
    id: "agent-3",
    type: "coder" as const,
    name: "Coder",
    status: "completed" as const,
    currentTask: null,
    progress: 100,
    tasks: [
      { id: "t7", title: "Write code", description: "Implement solution", status: "completed" as const },
      { id: "t8", title: "Test code", description: "Verify functionality", status: "completed" as const },
    ],
  },
  {
    id: "agent-4",
    type: "browser" as const,
    name: "Browser",
    status: "idle" as const,
    currentTask: null,
    progress: 0,
    tasks: [],
  },
];

/**
 * DemoChatClient - Demo chat page showcasing all UI components
 */
export function DemoChatClient() {
  const composerRef = React.useRef<ChatComposerRef>(null);
  const [messages, setMessages] = useState<UIMessage[]>(DEMO_MESSAGES);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Handle send message (demo only - doesn't call API)
  const handleSendMessage = useCallback(
    (parts: MessagePart[], files?: ChatAttachment[]) => {
      const textPart = parts.find((p) => p.type === "text") as
        | { type: "text"; text: string }
        | undefined;

      if (!textPart?.text.trim()) return;

      // Add user message
      const userMessage: UIMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        parts: [{ type: "text", text: textPart.text }],
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Simulate assistant response
      setIsStreaming(true);
      setTimeout(() => {
        const assistantMessage: UIMessage = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `This is a demo response to: "${textPart.text}"\n\nIn a real implementation, this would connect to your AI backend and stream the response.`,
              state: "done",
            },
          ],
          metadata: { model: "demo-model" },
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsStreaming(false);
      }, 1500);
    },
    []
  );

  // Handle tool approval (demo)
  const handleToolApproval = useCallback(
    (toolCallId: string, approved: boolean, reason?: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.role !== "assistant") return msg;
          return {
            ...msg,
            parts: msg.parts.map((part) => {
              if (
                (part.type.startsWith("tool-") || part.type === "dynamic-tool") &&
                "toolCallId" in part &&
                part.toolCallId === toolCallId
              ) {
                return {
                  ...part,
                  state: approved ? "output-available" : "output-denied",
                  output: approved
                    ? {
                        stdout: "Linux demo-host 5.15.0-generic #1 SMP x86_64 GNU/Linux\nFilesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       100G   45G   55G  45% /",
                        exitCode: 0,
                      }
                    : undefined,
                  approval: { id: (part as any).approval?.id, approved, reason },
                };
              }
              return part;
            }),
          };
        })
      );
    },
    []
  );

  // Handle message action
  const handleMessageAction = useCallback(
    (action: string, messageId: string) => {
      console.log(`Action: ${action} on message: ${messageId}`);
    },
    []
  );

  // Handle agent select
  const handleAgentSelect = useCallback((agentId: string) => {
    setSelectedAgentId((prev) => (prev === agentId ? null : agentId));
  }, []);

  return (
    <ChatContainer
      className="h-full"
      header={
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-medium">Demo Chat</h1>
            <ConnectionStatus isConnected={true} />
            <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600">
              Demo Mode
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Showcasing all UI components
          </div>
        </div>
      }
      footer={
        <div className="p-4">
          {/* Agent DAG */}
          <div className="mb-4">
            <AgentDagPanel
              agents={DEMO_AGENTS}
              selectedAgentId={selectedAgentId}
              onAgentSelect={handleAgentSelect}
              compact
            />
          </div>

          {/* Composer */}
          <div className="mx-auto max-w-3xl">
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
      }
    >
      <div className="mx-auto max-w-3xl">
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          onMessageAction={handleMessageAction}
          onToolApproval={handleToolApproval}
          emptyState={
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <span className="text-2xl">Demo</span>
              </div>
              <div>
                <h2 className="text-lg font-medium">Demo Chat</h2>
                <p className="text-sm text-muted-foreground">
                  This showcases all UI components
                </p>
              </div>
            </div>
          }
        />
      </div>
    </ChatContainer>
  );
}
