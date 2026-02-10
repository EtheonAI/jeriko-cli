import type { TimelineEntry } from "../types/index.js";

interface TimelineWriteOptions {
  format?: "json" | "text" | "markdown";
  includeMetadata?: boolean;
}

export class TimelineWriter {
  writeToString(entries: TimelineEntry[], options: TimelineWriteOptions = {}): string {
    const { format = "text", includeMetadata = true } = options;

    switch (format) {
      case "json":
        return JSON.stringify(entries, null, 2);

      case "markdown":
        return this.toMarkdown(entries, includeMetadata);

      case "text":
      default:
        return this.toText(entries, includeMetadata);
    }
  }

  private toText(entries: TimelineEntry[], includeMetadata: boolean): string {
    return entries
      .map((entry) => {
        let line = `[${entry.timestamp}] ${entry.event}`;
        if (includeMetadata && entry.metadata) {
          line += ` | ${JSON.stringify(entry.metadata)}`;
        }
        return line;
      })
      .join("\n");
  }

  private toMarkdown(entries: TimelineEntry[], includeMetadata: boolean): string {
    let markdown = "# Timeline\n\n";

    for (const entry of entries) {
      markdown += `## ${entry.event}\n\n`;
      markdown += `**Time:** ${entry.timestamp}\n\n`;

      if (includeMetadata && entry.metadata) {
        markdown += "**Metadata:**\n\n```json\n";
        markdown += JSON.stringify(entry.metadata, null, 2);
        markdown += "\n```\n\n";
      }
    }

    return markdown;
  }

  appendEntry(
    existingTimeline: string,
    entry: TimelineEntry,
    format: "json" | "text" | "markdown" = "text"
  ): string {
    if (format === "json") {
      const entries = existingTimeline ? JSON.parse(existingTimeline) : [];
      entries.push(entry);
      return JSON.stringify(entries, null, 2);
    }

    const newLine = this.toText([entry], true);
    return existingTimeline ? `${existingTimeline}\n${newLine}` : newLine;
  }

  static createEntry(event: string, metadata?: Record<string, unknown>): TimelineEntry {
    return {
      timestamp: new Date().toISOString(),
      event,
      metadata,
    };
  }

  filterByEvent(entries: TimelineEntry[], eventPattern: string): TimelineEntry[] {
    const regex = new RegExp(eventPattern, "i");
    return entries.filter((entry) => regex.test(entry.event));
  }

  filterByTimeRange(entries: TimelineEntry[], start: Date, end: Date): TimelineEntry[] {
    return entries.filter((entry) => {
      const entryTime = new Date(entry.timestamp);
      return entryTime >= start && entryTime <= end;
    });
  }
}
