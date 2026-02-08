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
      type: "tool_start";
      toolCallId?: string;
      tool: string;
      input: unknown;
    }
  | {
      type: "tool_result";
      toolCallId?: string;
      tool: string;
      success: boolean;
      result?: unknown;
      summary?: unknown;
    }
  | {
      type: "usage";
      usage: Record<string, number>;
      iterations: number;
      tool_calls_count: number;
    }
  | { type: "error"; error: unknown }
  | { type: "warning"; message: string }
  | { type: "sandbox_info"; sandboxId: string }
  | {
      type: "browser_frame";
      screenshot: string;
      url?: string;
      title?: string;
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

          const toolCallId = event.toolCallId || `tool_${Date.now()}`;
          const toolName = event.tool || "unknown";

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
          const toolCallId = event.toolCallId || "";
          const toolName = event.tool || "unknown";
          const success = event.success;

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
          // Forward sandbox ID to client as message metadata so the
          // canvas can make direct browser control requests.
          output += this.toSSE({
            type: "message-metadata",
            messageMetadata: {
              sandboxId: event.sandboxId,
            },
          });
          break;
        }

        case "browser_frame": {
          // Dedicated live browser frame event -- the client can use this
          // for real-time canvas updates without waiting for tool_result.
          // We emit it as message-metadata with a special key that
          // use-canvas can detect and render immediately.
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

        default:
          break;
      }

      return output;
    } catch {
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
