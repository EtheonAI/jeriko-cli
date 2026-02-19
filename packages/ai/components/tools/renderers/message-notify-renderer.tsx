"use client";

import * as React from "react";
import { Suspense } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { LoaderIcon } from "lucide-react";
import remarkGfm from "remark-gfm";
import type { ToolRendererProps } from "../tool-registry";
import { FilePart } from "../../parts/file-part";
import type { FileUIPart } from "../../../lib/types/ui-message";

const Markdown = React.lazy(() => import("react-markdown"));

interface MessageNotifyInput {
  text?: string;
  attachments?: string | string[];
}

interface MessageNotifyOutput {
  status?: string;
  message?: string;
  attachments?: Array<{
    name: string;
    url: string;
    mediaType: string;
  }>;
}

/** Shared markdown component overrides — same styles as TextPartRenderer */
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-4 mt-6 text-2xl font-semibold tracking-tight first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-5 text-xl font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 last:mb-0 leading-7">{children}</p>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-3 ml-6 list-disc space-y-1 [&>li]:pl-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-3 ml-6 list-decimal space-y-1 [&>li]:pl-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="leading-7">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-4 border-border" />,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-3 border-l-2 border-primary/40 pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, ...props }: { className?: string; children?: React.ReactNode }) => (
    <code
      className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground"
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
};

/**
 * MessageNotifyRenderer — Renders message_notify_user and message_ask_user.
 *
 * Shows the text message with markdown formatting, and if the tool output
 * includes uploaded file attachments, renders Manus-style file cards using
 * the existing FilePart component.
 */
export function MessageNotifyRenderer({
  state,
  input,
  output,
}: ToolRendererProps<MessageNotifyInput, MessageNotifyOutput>) {
  // Streaming state — args still being received (partial JSON)
  if (state === "input-streaming") {
    return (
      <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
        <LoaderIcon className="size-3.5 animate-spin" />
        <span>Sending message...</span>
      </div>
    );
  }

  // Input available — we have the full text, show it immediately (Manus parity).
  // The tool is still "executing" on the server (uploading attachments), but the
  // text content is already known. Don't make the user wait for output-available.
  if (state === "input-available") {
    const previewText = input?.text || "";
    if (!previewText) {
      return (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <LoaderIcon className="size-3.5 animate-spin" />
          <span>Sending message...</span>
        </div>
      );
    }
    return (
      <div className="text-sm leading-relaxed text-foreground/80">
        <Suspense fallback={<p className="whitespace-pre-wrap">{previewText}</p>}>
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {previewText}
          </Markdown>
        </Suspense>
      </div>
    );
  }

  if (state !== "output-available") return null;

  const text = input?.text || output?.message || "";
  const attachments = output?.attachments;
  const hasAttachments = attachments && attachments.length > 0;

  // If no attachments, just show the text with markdown formatting
  if (!hasAttachments) {
    if (!text) return null;
    return (
      <div className="text-sm leading-relaxed text-foreground/80">
        <Suspense fallback={<p className="whitespace-pre-wrap">{text}</p>}>
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {text}
          </Markdown>
        </Suspense>
      </div>
    );
  }

  // Convert attachments to FileUIPart format for our existing FilePart component
  const fileParts: FileUIPart[] = attachments.map((a) => ({
    type: "file" as const,
    mediaType: a.mediaType,
    filename: a.name,
    url: a.url,
  }));

  return (
    <div className="space-y-3">
      {/* Text message with markdown */}
      {text && (
        <div className="text-sm leading-relaxed text-foreground/80">
          <Suspense fallback={<p className="whitespace-pre-wrap">{text}</p>}>
            <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {text}
            </Markdown>
          </Suspense>
        </div>
      )}

      {/* File cards — Manus-style grid */}
      <div
        className={cn(
          "grid gap-3",
          fileParts.length === 1 && "grid-cols-1 max-w-sm",
          fileParts.length === 2 && "grid-cols-2 max-w-2xl",
          fileParts.length >= 3 && "grid-cols-2 md:grid-cols-3 max-w-3xl",
        )}
      >
        {fileParts.map((part, i) => (
          <FilePart key={i} part={part} />
        ))}
      </div>
    </div>
  );
}
