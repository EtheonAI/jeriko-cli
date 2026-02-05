"use client";

/**
 * Enhanced Terminal Output - Shell command results with ANSI color support
 *
 * Features:
 * - Full ANSI color code parsing
 * - Streaming output support
 * - Collapsible long output
 * - Copy command and output
 * - Exit code with status indicators
 * - Real-time elapsed time
 */

import * as React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  CheckIcon,
  CopyIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TerminalIcon,
  AlertCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

// ============================================================================
// ANSI Parser
// ============================================================================

interface AnsiSegment {
  text: string;
  classes: string[];
}

const ANSI_COLORS: Record<number, string> = {
  30: "ansi-black",
  31: "ansi-red",
  32: "ansi-green",
  33: "ansi-yellow",
  34: "ansi-blue",
  35: "ansi-magenta",
  36: "ansi-cyan",
  37: "ansi-white",
  90: "ansi-bright-black",
  91: "ansi-bright-red",
  92: "ansi-bright-green",
  93: "ansi-bright-yellow",
  94: "ansi-bright-blue",
  95: "ansi-bright-magenta",
  96: "ansi-bright-cyan",
  97: "ansi-bright-white",
};

const ANSI_STYLES: Record<number, string> = {
  1: "ansi-bold",
  2: "ansi-dim",
  3: "ansi-italic",
  4: "ansi-underline",
};

function parseAnsi(text: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentClasses: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        classes: [...currentClasses],
      });
    }

    // Parse the escape codes
    const codes = match[1].split(";").map(Number).filter(Boolean);

    for (const code of codes) {
      if (code === 0) {
        // Reset
        currentClasses = [];
      } else if (ANSI_COLORS[code]) {
        // Remove any existing color class
        currentClasses = currentClasses.filter(
          (c) =>
            !c.startsWith("ansi-") ||
            c.includes("bold") ||
            c.includes("dim") ||
            c.includes("italic") ||
            c.includes("underline")
        );
        currentClasses.push(ANSI_COLORS[code]);
      } else if (ANSI_STYLES[code]) {
        if (!currentClasses.includes(ANSI_STYLES[code])) {
          currentClasses.push(ANSI_STYLES[code]);
        }
      }
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      classes: [...currentClasses],
    });
  }

  return segments;
}

function AnsiText({ text }: { text: string }) {
  const segments = useMemo(() => parseAnsi(text), [text]);

  return (
    <>
      {segments.map((segment, i) => (
        <span key={i} className={cn(segment.classes)}>
          {segment.text}
        </span>
      ))}
    </>
  );
}

// ============================================================================
// Components
// ============================================================================

interface TerminalInput {
  id?: string;
  exec_dir?: string;
  command?: string;
}

interface TerminalOutput {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  error?: string;
  duration_ms?: number;
  signal?: string;
}

const MAX_LINES_COLLAPSED = 20;

function useCopyToClipboard(timeout = 2000) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = useCallback(
    async (text: string, id: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), timeout);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), timeout);
      }
    },
    [timeout]
  );

  return { copiedId, copy };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Main Component
// ============================================================================

export function TerminalOutputEnhanced({
  toolName,
  toolCallId,
  state,
  input,
  output,
  errorText,
}: ToolRendererProps<TerminalInput, TerminalOutput>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { copiedId, copy } = useCopyToClipboard();

  const typedInput = input as TerminalInput | undefined;
  const typedOutput = output as TerminalOutput | undefined;

  const command = typedInput?.command ?? "";
  const execDir = typedInput?.exec_dir ?? "~";

  const stdout = typedOutput?.stdout ?? "";
  const stderr = typedOutput?.stderr ?? "";
  const exitCode = typedOutput?.exit_code;
  const duration = typedOutput?.duration_ms;
  const signal = typedOutput?.signal;
  const error = typedOutput?.error ?? errorText;

  // Split output into lines for collapsing
  const stdoutLines = stdout.split("\n");
  const stderrLines = stderr.split("\n");
  const totalLines = stdoutLines.length + stderrLines.length;
  const needsCollapse = totalLines > MAX_LINES_COLLAPSED;

  const isSuccess = exitCode === 0;
  const hasOutput = state === "output-available" || state === "output-error";

  // Streaming state
  const isStreaming = state === "input-streaming" || state === "input-available";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-zinc-900">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="size-3 rounded-full bg-red-500" />
            <div className="size-3 rounded-full bg-yellow-500" />
            <div className="size-3 rounded-full bg-green-500" />
          </div>

          {/* Path */}
          <span className="text-xs text-zinc-400 font-mono ml-2 truncate max-w-[200px]">
            {execDir}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Duration */}
          {duration && (
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <ClockIcon className="size-3" />
              {formatDuration(duration)}
            </span>
          )}

          {/* Exit code */}
          {hasOutput && exitCode !== undefined && (
            <span
              className={cn(
                "text-xs font-mono px-1.5 py-0.5 rounded",
                isSuccess ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"
              )}
            >
              {isSuccess ? (
                <CheckIcon className="size-3 inline mr-1" />
              ) : (
                <XCircleIcon className="size-3 inline mr-1" />
              )}
              {exitCode}
            </span>
          )}

          {/* Copy button */}
          <button
            onClick={() => copy(command, "command")}
            className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200"
            title="Copy command"
          >
            {copiedId === "command" ? (
              <CheckIcon className="size-3.5 text-green-400" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Command */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="flex items-start gap-2 font-mono text-sm">
          <span className="text-green-400 select-none">$</span>
          <span
            className={cn(
              "text-zinc-200 whitespace-pre-wrap break-all",
              isStreaming && "typing-cursor"
            )}
          >
            {command}
          </span>
        </div>
      </div>

      {/* Output */}
      {hasOutput && (stdout || stderr || error) && (
        <div
          className={cn(
            "relative",
            needsCollapse && !isExpanded && "max-h-[300px] overflow-hidden"
          )}
        >
          <div className="px-3 py-2 font-mono text-sm terminal-output">
            {/* Stdout */}
            {stdout && (
              <div className="text-zinc-300">
                <AnsiText
                  text={
                    isExpanded || !needsCollapse
                      ? stdout
                      : stdoutLines.slice(0, MAX_LINES_COLLAPSED).join("\n")
                  }
                />
              </div>
            )}

            {/* Stderr */}
            {stderr && (
              <div className="text-red-400 mt-2">
                <AnsiText text={stderr} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-red-400 mt-2">
                <AlertCircleIcon className="size-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Signal */}
            {signal && (
              <div className="text-yellow-400 mt-2">Process terminated by signal: {signal}</div>
            )}
          </div>

          {/* Fade gradient for collapsed state */}
          {needsCollapse && !isExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-zinc-900 to-transparent" />
          )}
        </div>
      )}

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="px-3 py-4 flex items-center gap-2 text-zinc-400">
          <div className="size-4 border-2 border-zinc-600 border-t-primary rounded-full spinner" />
          <span className="text-sm">Executing command...</span>
        </div>
      )}

      {/* Expand/collapse button */}
      {needsCollapse && hasOutput && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex items-center justify-center gap-1 border-t border-zinc-800"
        >
          {isExpanded ? (
            <>
              <ChevronUpIcon className="size-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDownIcon className="size-3.5" />
              Show all {totalLines} lines
            </>
          )}
        </button>
      )}

      {/* Copy output button */}
      {hasOutput && (stdout || stderr) && (
        <button
          onClick={() => copy(stdout + (stderr ? "\n" + stderr : ""), "output")}
          className="w-full px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex items-center justify-center gap-1 border-t border-zinc-800"
        >
          {copiedId === "output" ? (
            <>
              <CheckIcon className="size-3.5 text-green-400" />
              Copied output
            </>
          ) : (
            <>
              <CopyIcon className="size-3.5" />
              Copy output
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default TerminalOutputEnhanced;
