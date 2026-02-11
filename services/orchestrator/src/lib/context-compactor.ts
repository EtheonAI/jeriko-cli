export interface CompactMessage {
  role: string;
  content: string;
  timestamp?: string;
}

interface CompactionOptions {
  maxTokens?: number;
  keepRecent?: number;
  preserveSystem?: boolean;
}

export class ContextCompactor {
  private readonly defaultMaxTokens = 100000;
  private readonly avgCharsPerToken = 4;

  compact(messages: CompactMessage[], options: CompactionOptions = {}): CompactMessage[] {
    const { maxTokens = this.defaultMaxTokens, keepRecent = 10, preserveSystem = true } = options;

    if (messages.length === 0) {
      return [];
    }

    const systemMessages = preserveSystem ? messages.filter((m) => m.role === "system") : [];

    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const recentMessages = nonSystemMessages.slice(-keepRecent);

    const estimatedTokens = this.estimateTokens([...systemMessages, ...recentMessages]);

    if (estimatedTokens <= maxTokens) {
      return [...systemMessages, ...recentMessages];
    }

    const maxChars = maxTokens * this.avgCharsPerToken;
    const compacted: CompactMessage[] = [...systemMessages];
    let totalChars = systemMessages.reduce((sum, m) => sum + m.content.length, 0);

    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i];
      if (msg && totalChars + msg.content.length <= maxChars) {
        compacted.unshift(msg);
        totalChars += msg.content.length;
      } else {
        break;
      }
    }

    return compacted;
  }

  estimateTokens(messages: CompactMessage[]): number {
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    return Math.ceil(totalChars / this.avgCharsPerToken);
  }

  summarize(messages: CompactMessage[]): string {
    const summary = messages
      .map((m, i) => {
        const preview = m.content.slice(0, 100);
        return `[${i}] ${m.role}: ${preview}${m.content.length > 100 ? "..." : ""}`;
      })
      .join("\n");

    return `Context summary (${messages.length} messages):\n${summary}`;
  }
}

/**
 * Backward-compatible helper used by the orchestrator loop tests.
 *
 * `maxMessages` is a message-count threshold (not token threshold):
 * - If history size is <= threshold, keep all and return null compactedHistory.
 * - If above threshold, keep newest `maxMessages` and summarize older entries.
 */
export function compactHistory(messages: CompactMessage[], maxMessages = 20): {
  kept: CompactMessage[];
  compactedHistory: string | null;
} {
  if (messages.length <= maxMessages) {
    return { kept: messages, compactedHistory: null };
  }

  const kept = messages.slice(-maxMessages);
  const older = messages.slice(0, messages.length - maxMessages);
  const compactor = new ContextCompactor();

  const compactedHistory = `<compacted_history>\n${compactor.summarize(older)}\n</compacted_history>`;

  return { kept, compactedHistory };
}
