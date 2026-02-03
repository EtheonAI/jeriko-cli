"use client";

import * as React from "react";
import Markdown from "react-markdown";
import { cn } from "@repo/design-system/lib/utils";
import type { TextUIPart } from "../../lib/types/ui-message";

export interface TextPartProps {
  part: TextUIPart;
  className?: string;
  enableMarkdown?: boolean;
}

/**
 * TextPart - Renders text content with optional markdown support
 */
export function TextPart({
  part,
  className,
  enableMarkdown = true,
}: TextPartProps) {
  const isStreaming = part.state === "streaming";

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      {enableMarkdown ? (
        <Markdown
          components={{
            // Custom link rendering
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {children}
              </a>
            ),
            // Code blocks with syntax highlighting placeholder
            code: ({ className: codeClassName, children, ...props }) => {
              const match = /language-(\w+)/.exec(codeClassName || "");
              const isInline = !match;

              if (isInline) {
                return (
                  <code
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
                    {...props}
                  >
                    {children}
                  </code>
                );
              }

              return (
                <div className="relative my-4 overflow-hidden rounded-lg border border-border bg-muted">
                  <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
                    <span className="text-xs text-muted-foreground">
                      {match?.[1] ?? "code"}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(String(children))}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="overflow-x-auto p-4">
                    <code className={cn("font-mono text-sm", codeClassName)} {...props}>
                      {children}
                    </code>
                  </pre>
                </div>
              );
            },
            // Tables
            table: ({ children }) => (
              <div className="my-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  {children}
                </table>
              </div>
            ),
            // Block quotes
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            ),
          }}
        >
          {part.text}
        </Markdown>
      ) : (
        <p className="whitespace-pre-wrap">{part.text}</p>
      )}

      {/* Streaming cursor */}
      {isStreaming && (
        <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground" />
      )}
    </div>
  );
}
