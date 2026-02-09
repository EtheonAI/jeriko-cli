// ============================================================
// SSE -> AI SDK Data Stream Transform
// ============================================================

import { extractErrorMessage } from "./error-detection";

// ============================================================
// Type definitions
// ============================================================

export type AgentSSEEvent =
  | { type: "content"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "reasoning_end" }
  | { type: "source_url"; url: string; title?: string; sourceId?: string }
  | {
      type: "tool_start" | "tool_call_started";
      toolCallId?: string;
      tool: string;
      input: unknown;
    }
  | {
      type: "tool_result" | "tool_call_completed";
      toolCallId?: string;
      tool: string;
      success: boolean;
      result?: unknown;
      summary?: unknown;
    }
  | {
      type: "tool_call_failed";
      toolCallId?: string;
      tool: string;
      success: false;
      error?: string;
    }
  | {
      type: "tool_stream_chunk";
      toolCallId?: string;
      chunk: string;
      stream?: "stdout" | "stderr";
    }
  | {
      type: "usage";
      usage: Record<string, number>;
      iterations: number;
      tool_calls_count: number;
    }
  | { type: "error"; error: unknown }
  | { type: "warning"; message: string }
  | {
      type: "sandbox_info";
      sandboxId: string;
      vncUrl?: string;
      nekoUrl?: string;
      streamUrl?: string;
    }
  | {
      type: "session_created";
      sessionId: string;
      sandboxId: string;
      nekoUrl?: string;
    }
  | {
      type: "session_reconnected";
      sessionId: string;
      sandboxId: string;
    }
  | { type: "session_expired"; sessionId: string }
  | { type: "session_terminated"; sessionId: string }
  | {
      type: "neko_ready";
      sandboxId: string;
      nekoUrl: string;
    }
  | {
      type: "browser_frame";
      screenshot: string;
      url?: string;
      title?: string;
    }
  | {
      type: "browser_state";
      url?: string;
      title?: string;
      loading?: boolean;
    }
  | {
      type: "file_created" | "file_updated" | "file_read";
      path: string;
      contentPreview?: string;
    };

/**
 * Stateful processor that converts agent SSE events into AI SDK v6
 * UIMessage stream chunks.  Tracks whether a text part is currently
 * open so we can emit the required text-start / text-delta / text-end
 * lifecycle events.
 */
export class SSEProcessor {
  private textPartId = "text-0";
  private textPartOpen = false;
  private textPartCounter = 0;

  private reasoningPartId = "reasoning-0";
  private reasoningPartOpen = false;
  private reasoningPartCounter = 0;
  private currentReasoningAccum = "";

  private stepOpen = false;
  private stepCounter = 0;

  /**
   * Track active tool calls by toolCallId for correlation.
   * Maps toolCallId → toolName for tools that have started but not yet received results.
   * Used to:
   * 1. Resolve tool_result events that arrive without toolCallId
   * 2. Ensure tool_result always has a matching tool_start (emit synthetic start if needed)
   */
  private activeToolCalls = new Map<string, string>();
  /** Stack of toolCallIds in order of tool_start arrival (most recent last) */
  private toolCallStack: string[] = [];
  /** Counter for generating unique fallback tool IDs */
  private toolIdCounter = 0;

  collectedText: string[] = [];
  collectedToolSteps: Array<{
    id: string;
    toolName: string;
    label: string;
    status: string;
  }> = [];

  /**
   * Collected UIMessage parts -- mirrors what the AI SDK client assembles.
   * Saved to DB server-side when the stream ends for historical replay.
   */
  collectedParts: Record<string, unknown>[] = [];

  /** Accumulator for the current text part being streamed */
  private currentTextAccum = "";

  private toSSE(chunk: object) {
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  /** Flush any accumulated text into a text part in collectedParts. */
  private flushTextPart() {
    if (this.currentTextAccum) {
      this.collectedParts.push({ type: "text", text: this.currentTextAccum });
      this.currentTextAccum = "";
    }
  }

  /** Open a new step boundary (returns start-step SSE). */
  private openStep(): string {
    if (this.stepOpen) return "";
    this.stepCounter++;
    this.stepOpen = true;
    return this.toSSE({ type: "start-step" });
  }

  /** Close any open step boundary (returns finish-step SSE or empty string). */
  closeStep(): string {
    if (!this.stepOpen) return "";
    this.stepOpen = false;
    return this.toSSE({ type: "finish-step" });
  }

  /** Close any open text part (returns text-end SSE or empty string). */
  closeTextPart(): string {
    if (!this.textPartOpen) return "";
    this.textPartOpen = false;
    this.flushTextPart();
    return this.toSSE({ type: "text-end", id: this.textPartId });
  }

  /** Open a new text part (returns text-start SSE). */
  private openTextPart(): string {
    this.textPartCounter++;
    this.textPartId = `text-${this.textPartCounter}`;
    this.textPartOpen = true;
    return this.toSSE({ type: "text-start", id: this.textPartId });
  }

  /** Close any open reasoning part (returns reasoning-end SSE or empty string). */
  closeReasoningPart(): string {
    if (!this.reasoningPartOpen) return "";
    this.reasoningPartOpen = false;
    if (this.currentReasoningAccum) {
      this.collectedParts.push({ type: "reasoning", text: this.currentReasoningAccum });
      this.currentReasoningAccum = "";
    }
    return this.toSSE({ type: "reasoning-end", id: this.reasoningPartId });
  }

  /** Open a new reasoning part (returns reasoning-start SSE). */
  private openReasoningPart(): string {
    this.reasoningPartCounter++;
    this.reasoningPartId = `reasoning-${this.reasoningPartCounter}`;
    this.reasoningPartOpen = true;
    return this.toSSE({ type: "reasoning-start", id: this.reasoningPartId });
  }

  process(part: string): string {
    // Extract data from SSE lines
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("data: ")) {
        data += line.slice(6);
      } else if (line.startsWith("data:")) {
        data += line.slice(5);
      }
    }

    if (!data) return "";
    if (data === "[DONE]") return "";

    try {
      const event = JSON.parse(data) as AgentSSEEvent;
      let output = "";

      switch (event.type) {
        case "content": {
          const text = event.content || "";
          if (text) {
            // Close any open reasoning part — content is separate
            output += this.closeReasoningPart();
            this.collectedText.push(text);
            this.currentTextAccum += text;
            // Open a text part if not already open
            if (!this.textPartOpen) {
              output += this.openTextPart();
            }
            output += this.toSSE({ type: "text-delta", id: this.textPartId, delta: text });
          }
          break;
        }

        case "reasoning": {
          const text = event.content || "";
          if (text) {
            // Close any open text part — reasoning is separate
            output += this.closeTextPart();
            this.currentReasoningAccum += text;
            if (!this.reasoningPartOpen) {
              output += this.openReasoningPart();
            }
            output += this.toSSE({ type: "reasoning-delta", id: this.reasoningPartId, delta: text });
          }
          break;
        }

        case "reasoning_end": {
          output += this.closeReasoningPart();
          break;
        }

        case "source_url": {
          output += this.toSSE({
            type: "source-url",
            sourceId: event.sourceId || String(Date.now()),
            url: event.url,
            title: event.title,
          });
          this.collectedParts.push({
            type: "source-url",
            sourceId: event.sourceId || String(Date.now()),
            url: event.url,
            title: event.title,
          });
          break;
        }

        case "tool_start": {
          // Close any open text/reasoning parts before tool events
          output += this.closeTextPart();
          output += this.closeReasoningPart();

          // Open a step boundary if not already open
          output += this.openStep();

          // Generate unique fallback ID if agent doesn't provide one
          this.toolIdCounter++;
          const toolCallId = event.toolCallId || `tool_${Date.now()}_${this.toolIdCounter}`;
          const toolName = event.tool || "unknown";

          // Track this tool call for correlation with tool_result
          this.activeToolCalls.set(toolCallId, toolName);
          this.toolCallStack.push(toolCallId);

          // Emit tool-input-start to open the tool part (input-streaming state)
          output += this.toSSE({
            type: "tool-input-start",
            toolCallId,
            toolName,
          });

          // Immediately emit tool-input-available with full args
          output += this.toSSE({
            type: "tool-input-available",
            toolCallId,
            toolName,
            input: event.input || {},
          });

          this.collectedToolSteps.push({
            id: toolCallId,
            toolName,
            label: toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            status: "in_progress",
          });

          // Add tool part to collected parts (will be updated on tool_result)
          this.collectedParts.push({
            type: `tool-${toolName}`,
            toolCallId,
            toolName,
            state: "input-available",
            input: event.input || {},
          });
          break;
        }

        case "tool_result": {
          output += this.closeTextPart();
          const toolName = event.tool || "unknown";
          const success = event.success;

          // Resolve toolCallId: use provided ID, or look up from active tools
          let toolCallId = event.toolCallId || "";
          if (!toolCallId || !this.activeToolCalls.has(toolCallId)) {
            // No ID or unknown ID — match by toolName or use last active tool
            const matchByName = this.toolCallStack.find(
              (id) => this.activeToolCalls.get(id) === toolName
            );
            if (matchByName) {
              toolCallId = matchByName;
            } else if (this.toolCallStack.length > 0) {
              // Fall back to most recent active tool
              toolCallId = this.toolCallStack[this.toolCallStack.length - 1]!;
            }
          }

          // If we still have no matching tool_start, emit a synthetic one first.
          // The AI SDK's getToolInvocation() REQUIRES a matching tool part to exist
          // in state.message.parts before processing tool-output-available.
          if (!this.activeToolCalls.has(toolCallId)) {
            this.toolIdCounter++;
            if (!toolCallId) toolCallId = `tool_${Date.now()}_${this.toolIdCounter}`;
            output += this.openStep();
            output += this.toSSE({
              type: "tool-input-start",
              toolCallId,
              toolName,
            });
            output += this.toSSE({
              type: "tool-input-available",
              toolCallId,
              toolName,
              input: {},
            });
            this.collectedParts.push({
              type: `tool-${toolName}`,
              toolCallId,
              toolName,
              state: "input-available",
              input: {},
            });
          }

          // Remove from active tracking
          this.activeToolCalls.delete(toolCallId);
          this.toolCallStack = this.toolCallStack.filter((id) => id !== toolCallId);

          if (success) {
            // AI SDK v6 tool-output-available schema: { type, toolCallId, output }
            // toolName is NOT allowed here (only in tool-input-start/tool-input-available)
            output += this.toSSE({
              type: "tool-output-available",
              toolCallId,
              output: event.result ?? event.summary,
            });
          } else {
            const errorText =
              typeof event.result === "object" && event.result && "error" in event.result
                ? (event.result as { error: string }).error
                : typeof event.summary === "string"
                  ? event.summary
                  : "Tool execution failed";
            // AI SDK v6 tool-output-error schema: { type, toolCallId, errorText }
            // toolName is NOT allowed here
            output += this.toSSE({
              type: "tool-output-error",
              toolCallId,
              errorText,
            });
          }

          // Update the tool part in collectedParts with output/error state
          const toolPart = [...this.collectedParts]
            .reverse()
            .find((p) => (p as Record<string, unknown>).toolCallId === toolCallId);
          if (toolPart) {
            toolPart.state = success ? "output-available" : "output-error";
            toolPart.output = success ? (event.result ?? event.summary) : undefined;
          }

          const step = this.collectedToolSteps.find((s) => s.id === toolCallId);
          if (step) {
            step.status = success ? "completed" : "cancelled";
          }
          break;
        }

        case "usage": {
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: {
              usage: event.usage,
              iterations: event.iterations,
              toolCallsCount: event.tool_calls_count,
            },
          });
          break;
        }

        case "error": {
          output += this.closeTextPart();
          // event.error may be a string OR a nested object -- extract the message
          const errorText = extractErrorMessage(event.error);
          output += this.toSSE({ type: "error", errorText });
          break;
        }

        case "warning": {
          const msg = event.message || "Warning";
          if (!this.textPartOpen) {
            output += this.openTextPart();
          }
          output += this.toSSE({ type: "text-delta", id: this.textPartId, delta: `\n\n⚠️ ${msg}` });
          this.collectedText.push(`\n\n⚠️ ${msg}`);
          this.currentTextAccum += `\n\n⚠️ ${msg}`;
          break;
        }

        case "sandbox_info": {
          // Forward sandbox ID + Neko/VNC URL to client as message metadata
          // so the canvas can make direct browser control requests and embed Neko/noVNC.
          const sandboxMeta: Record<string, unknown> = {
            sandboxId: event.sandboxId,
          };
          if (event.nekoUrl) {
            sandboxMeta.nekoUrl = event.nekoUrl;
          }
          if (event.vncUrl) {
            sandboxMeta.vncUrl = event.vncUrl;
          }
          if (event.streamUrl) {
            sandboxMeta.streamUrl = event.streamUrl;
          }
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: sandboxMeta,
          });
          break;
        }

        case "session_created":
        case "session_reconnected": {
          // Session lifecycle events — forward sandbox + Neko info as metadata
          const sessionMeta: Record<string, unknown> = {
            sandboxId: event.sandboxId,
            sessionEvent: event.type,
          };
          if ("nekoUrl" in event && event.nekoUrl) {
            sessionMeta.nekoUrl = event.nekoUrl;
          }
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: sessionMeta,
          });
          break;
        }

        case "session_expired":
        case "session_terminated": {
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: {
              sessionEvent: event.type,
              sessionId: event.sessionId,
            },
          });
          break;
        }

        case "neko_ready": {
          // Neko WebRTC server is ready — forward connection info to canvas
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: {
              nekoUrl: event.nekoUrl,
              sandboxId: event.sandboxId,
              nekoReady: true,
            },
          });
          break;
        }

        case "tool_stream_chunk": {
          // Real-time streaming output from shell/code tools.
          // Forward as message-metadata so terminal-view can display live.
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: {
              toolStreamChunk: {
                toolCallId: event.toolCallId || "",
                chunk: event.chunk,
                stream: event.stream || "stdout",
              },
            },
          });
          break;
        }

        case "tool_call_started": {
          // Alias for "tool_start" — handle identically
          output += this.closeTextPart();
          output += this.closeReasoningPart();
          output += this.openStep();

          this.toolIdCounter++;
          const tcId = event.toolCallId || `tool_${Date.now()}_${this.toolIdCounter}`;
          const tcName = event.tool || "unknown";

          this.activeToolCalls.set(tcId, tcName);
          this.toolCallStack.push(tcId);

          output += this.toSSE({ type: "tool-input-start", toolCallId: tcId, toolName: tcName });
          output += this.toSSE({
            type: "tool-input-available",
            toolCallId: tcId,
            toolName: tcName,
            input: event.input || {},
          });

          this.collectedToolSteps.push({
            id: tcId,
            toolName: tcName,
            label: tcName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            status: "in_progress",
          });
          this.collectedParts.push({
            type: `tool-${tcName}`,
            toolCallId: tcId,
            toolName: tcName,
            state: "input-available",
            input: event.input || {},
          });
          break;
        }

        case "tool_call_completed": {
          // Alias for "tool_result" with success=true — handle identically
          output += this.closeTextPart();
          const tcName2 = event.tool || "unknown";
          let tcId2 = event.toolCallId || "";
          if (!tcId2 || !this.activeToolCalls.has(tcId2)) {
            const match = this.toolCallStack.find((id) => this.activeToolCalls.get(id) === tcName2);
            if (match) tcId2 = match;
            else if (this.toolCallStack.length > 0) tcId2 = this.toolCallStack[this.toolCallStack.length - 1]!;
          }
          if (!this.activeToolCalls.has(tcId2)) {
            this.toolIdCounter++;
            if (!tcId2) tcId2 = `tool_${Date.now()}_${this.toolIdCounter}`;
            output += this.openStep();
            output += this.toSSE({ type: "tool-input-start", toolCallId: tcId2, toolName: tcName2 });
            output += this.toSSE({ type: "tool-input-available", toolCallId: tcId2, toolName: tcName2, input: {} });
            this.collectedParts.push({ type: `tool-${tcName2}`, toolCallId: tcId2, toolName: tcName2, state: "input-available", input: {} });
          }
          this.activeToolCalls.delete(tcId2);
          this.toolCallStack = this.toolCallStack.filter((id) => id !== tcId2);
          output += this.toSSE({ type: "tool-output-available", toolCallId: tcId2, output: event.result ?? event.summary });
          const tp2 = [...this.collectedParts].reverse().find((p) => (p as Record<string, unknown>).toolCallId === tcId2);
          if (tp2) { tp2.state = "output-available"; tp2.output = event.result ?? event.summary; }
          const step2 = this.collectedToolSteps.find((s) => s.id === tcId2);
          if (step2) step2.status = "completed";
          break;
        }

        case "tool_call_failed": {
          // Alias for "tool_result" with success=false — handle identically
          output += this.closeTextPart();
          const tcName3 = event.tool || "unknown";
          let tcId3 = event.toolCallId || "";
          if (!tcId3 || !this.activeToolCalls.has(tcId3)) {
            const match = this.toolCallStack.find((id) => this.activeToolCalls.get(id) === tcName3);
            if (match) tcId3 = match;
            else if (this.toolCallStack.length > 0) tcId3 = this.toolCallStack[this.toolCallStack.length - 1]!;
          }
          if (!this.activeToolCalls.has(tcId3)) {
            this.toolIdCounter++;
            if (!tcId3) tcId3 = `tool_${Date.now()}_${this.toolIdCounter}`;
            output += this.openStep();
            output += this.toSSE({ type: "tool-input-start", toolCallId: tcId3, toolName: tcName3 });
            output += this.toSSE({ type: "tool-input-available", toolCallId: tcId3, toolName: tcName3, input: {} });
            this.collectedParts.push({ type: `tool-${tcName3}`, toolCallId: tcId3, toolName: tcName3, state: "input-available", input: {} });
          }
          this.activeToolCalls.delete(tcId3);
          this.toolCallStack = this.toolCallStack.filter((id) => id !== tcId3);
          const errText = event.error || "Tool execution failed";
          output += this.toSSE({ type: "tool-output-error", toolCallId: tcId3, errorText: errText });
          const tp3 = [...this.collectedParts].reverse().find((p) => (p as Record<string, unknown>).toolCallId === tcId3);
          if (tp3) tp3.state = "output-error";
          const step3 = this.collectedToolSteps.find((s) => s.id === tcId3);
          if (step3) step3.status = "cancelled";
          break;
        }

        case "browser_frame": {
          // Dedicated live browser frame event -- the client can use this
          // for real-time canvas updates without waiting for tool_result.
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: {
              browserFrame: {
                screenshot: event.screenshot,
                url: event.url || "",
                title: event.title || "",
              },
            },
          });
          break;
        }

        case "browser_state": {
          // Browser state update (URL, title, loading) without screenshot
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: {
              browserState: {
                url: event.url || "",
                title: event.title || "",
                loading: event.loading ?? false,
              },
            },
          });
          break;
        }

        case "file_created":
        case "file_updated":
        case "file_read": {
          // File operation events — forward as metadata for canvas code view
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: {
              fileEvent: {
                type: event.type,
                path: event.path,
                contentPreview: event.contentPreview,
              },
            },
          });
          break;
        }

        default:
          break;
      }

      return output;
    } catch (err) {
      console.warn("[SSEProcessor] Failed to parse SSE event:", data.slice(0, 200), err);
      return "";
    }
  }

  /** Finalize stream — close open parts and return collected parts for DB persistence. */
  finalize(): { parts: Record<string, unknown>[]; closingSSE: string } {
    let closingSSE = "";
    closingSSE += this.closeTextPart();
    closingSSE += this.closeReasoningPart();
    closingSSE += this.closeStep();

    // Flush any remaining text/reasoning
    this.flushTextPart();
    if (this.currentReasoningAccum) {
      this.collectedParts.push({ type: "reasoning", text: this.currentReasoningAccum });
      this.currentReasoningAccum = "";
    }
    return { parts: this.collectedParts, closingSSE };
  }

  /** @deprecated Use finalize() instead */
  finalizeParts(): Record<string, unknown>[] {
    return this.finalize().parts;
  }
}
