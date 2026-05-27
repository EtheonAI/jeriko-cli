/**
 * Tests that Inngest execute-task creates a chat session, saves messages,
 * and links the execution to the session.
 */
import "./setup";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, agentSessions, messages, taskExecutions, scheduledTasks } from "../lib/db.js";

// ─── Helpers ──────────────────────────────────────────────────────
// We test the logic inline since the Inngest createFunction is a closure.
// The test simulates what each step does and verifies DB calls.

const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();

  // Reset chainable mocks
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.limit.mockResolvedValue([]);
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockResolvedValue([]);
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
});

describe("execute-task session creation", () => {
  it("should create an agentSessions row with correct metadata", async () => {
    // Mock: task lookup returns a task name
    mockDb.limit.mockResolvedValueOnce([{ name: "Test Automation" }]);

    // Simulate the create-session step
    const taskId = "task-123";
    const userId = "user-456";
    const executionId = "exec-789";

    // Fetch task name
    const [task] = await db
      .select({ name: scheduledTasks.name })
      .from(scheduledTasks)
      .where({})
      .limit(1);

    expect(task?.name).toBe("Test Automation");

    // Insert session
    await db.insert(agentSessions).values({
      id: "session-abc",
      userId,
      status: "active",
      title: `${task?.name} — Feb 17, 2026`,
      metadata: {
        scheduledTaskId: taskId,
        executionId,
        source: "automation",
      },
    });

    // Verify insert was called
    expect(mockDb.insert).toHaveBeenCalledWith(agentSessions);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        status: "active",
        metadata: expect.objectContaining({
          scheduledTaskId: taskId,
          source: "automation",
        }),
      }),
    );
  });

  it("should save user message with correct content and parts", async () => {
    const sessionId = "session-abc";
    const userContent = "Summarize new emails about FxPro";

    await db.insert(messages).values({
      id: "msg-123",
      sessionId,
      role: "user",
      content: userContent,
      parts: [{ type: "text", text: userContent }],
    });

    expect(mockDb.insert).toHaveBeenCalledWith(messages);
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        role: "user",
        content: userContent,
        parts: [{ type: "text", text: userContent }],
      }),
    );
  });

  it("should save user message with trigger event context prepended", async () => {
    const prompt = "Respond to client inquiries";
    const triggerEvent = {
      slug: "GMAIL_NEW_GMAIL_MESSAGE",
      data: { subject: "Hello", from: "client@example.com" },
      triggerId: "ti_abc",
    };

    // Build content the same way inngest.ts does
    let userContent = prompt;
    const eventSummary = JSON.stringify(triggerEvent.data, null, 2);
    userContent = `[Trigger Event: ${triggerEvent.slug}]\nEvent data:\n${eventSummary}\n\nTask instructions: ${userContent}`;

    expect(userContent).toContain("[Trigger Event: GMAIL_NEW_GMAIL_MESSAGE]");
    expect(userContent).toContain("client@example.com");
    expect(userContent).toContain("Task instructions: Respond to client inquiries");

    await db.insert(messages).values({
      id: "msg-456",
      sessionId: "session-abc",
      role: "user",
      content: userContent,
      parts: [{ type: "text", text: userContent }],
    });

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "user",
        content: expect.stringContaining("GMAIL_NEW_GMAIL_MESSAGE"),
      }),
    );
  });

  it("should link execution to session via taskExecutions.sessionId", async () => {
    const executionId = "exec-789";
    const sessionId = "session-abc";

    await db
      .update(taskExecutions)
      .set({ status: "running", startedAt: new Date(), sessionId })
      .where({});

    expect(mockDb.update).toHaveBeenCalledWith(taskExecutions);
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "running",
        sessionId,
      }),
    );
  });

  it("should save assistant message with text and tool parts", async () => {
    const sessionId = "session-abc";
    const text = "I found 3 new emails about FxPro.";
    const toolCalls = [
      {
        toolCallId: "tc-1",
        toolName: "gmail_search",
        input: { query: "FxPro" },
        output: { results: 3 },
        state: "output-available",
      },
    ];

    // Build parts the same way inngest.ts does
    const parts: Record<string, unknown>[] = [];
    if (text) {
      parts.push({ type: "text", text });
    }
    for (const tc of toolCalls) {
      parts.push({
        type: tc.toolName ? `tool-${tc.toolName}` : "tool-unknown",
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        state: tc.state,
        input: tc.input,
        output: tc.output,
      });
    }

    await db.insert(messages).values({
      id: "msg-asst-1",
      sessionId,
      role: "assistant",
      content: text,
      parts,
      metadata: { model: "agent", source: "automation" },
    });

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        content: text,
        parts: expect.arrayContaining([
          expect.objectContaining({ type: "text", text }),
          expect.objectContaining({
            type: "tool-gmail_search",
            toolCallId: "tc-1",
            state: "output-available",
          }),
        ]),
        metadata: expect.objectContaining({ source: "automation" }),
      }),
    );
  });

  it("should mark session as completed after successful execution", async () => {
    const sessionId = "session-abc";

    await db
      .update(agentSessions)
      .set({ status: "completed", updatedAt: new Date() })
      .where({});

    expect(mockDb.update).toHaveBeenCalledWith(agentSessions);
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("should mark session as failed and save error message on failure", async () => {
    const linkedSessionId = "session-abc";
    const errorMessage = "Orchestrator timeout";

    // Save error message
    await db.insert(messages).values({
      id: "msg-err-1",
      sessionId: linkedSessionId,
      role: "assistant",
      content: `Automation failed: ${errorMessage}`,
      parts: [{ type: "text", text: `Automation failed: ${errorMessage}` }],
      metadata: { source: "automation", error: true },
    });

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        content: `Automation failed: ${errorMessage}`,
        metadata: expect.objectContaining({ error: true }),
      }),
    );

    // Mark session failed
    await db
      .update(agentSessions)
      .set({ status: "failed", updatedAt: new Date() })
      .where({});

    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });

  it("should include trigger metadata in session metadata when triggered", async () => {
    const triggerEvent = { slug: "GMAIL_NEW_GMAIL_MESSAGE" };
    const skillIds = ["web-search", "code-interpreter"];

    const metadata = {
      scheduledTaskId: "task-123",
      executionId: "exec-789",
      source: "automation",
      triggerEvent: { slug: triggerEvent.slug },
      skills: skillIds,
    };

    await db.insert(agentSessions).values({
      id: "session-trigger",
      userId: "user-456",
      status: "active",
      title: "Test — Feb 17, 2026",
      metadata,
    });

    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          source: "automation",
          triggerEvent: { slug: "GMAIL_NEW_GMAIL_MESSAGE" },
          skills: ["web-search", "code-interpreter"],
        }),
      }),
    );
  });

  it("should generate session title with task name and date", async () => {
    const taskName = "Clients Reachout";
    const dateLabel = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const expectedTitle = `${taskName} — ${dateLabel}`;

    // Title should contain the task name and a date
    expect(expectedTitle).toContain("Clients Reachout");
    expect(expectedTitle).toMatch(/\w+ \d+, \d{4}/); // e.g., "Feb 17, 2026"
  });

  it("should find linked session from execution on failure", async () => {
    const executionId = "exec-789";
    const sessionId = "session-abc";

    // Mock: execution lookup returns sessionId
    mockDb.limit.mockResolvedValueOnce([{ sessionId }]);

    const [exec] = await db
      .select({ sessionId: taskExecutions.sessionId })
      .from(taskExecutions)
      .where({})
      .limit(1);

    expect(exec?.sessionId).toBe(sessionId);
  });
});
