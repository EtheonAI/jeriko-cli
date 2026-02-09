"use client";

import * as React from "react";
import { useRef, useEffect, useCallback, useState } from "react";
import { TerminalIcon, WifiIcon, WifiOffIcon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import { AnsiText } from "../../../lib/ansi";

// ============================================================================
// Types
// ============================================================================

export interface TerminalViewProps {
  output?: string[];
  /** Live PTY output from WebSocket (overrides static output when connected) */
  liveOutput?: string[];
  /** Whether the live PTY stream is connected */
  liveConnected?: boolean;
  /** Send keyboard input to the PTY */
  onSendInput?: (data: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function TerminalView({
  output,
  liveOutput,
  liveConnected,
  onSendInput,
}: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [interactiveMode, setInteractiveMode] = useState(false);

  // Use live output when connected, otherwise fall back to static output
  const displayOutput = liveConnected && liveOutput ? liveOutput : output;

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [displayOutput]);

  // Handle keyboard input when in interactive mode
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!interactiveMode || !onSendInput) return;

      if (e.key === "Escape") {
        setInteractiveMode(false);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Enter") {
        onSendInput("\r");
      } else if (e.key === "Backspace") {
        onSendInput("\x7f");
      } else if (e.key === "Tab") {
        onSendInput("\t");
      } else if (e.ctrlKey && e.key === "c") {
        onSendInput("\x03");
      } else if (e.ctrlKey && e.key === "d") {
        onSendInput("\x04");
      } else if (e.key.length === 1) {
        onSendInput(e.key);
      }
    },
    [interactiveMode, onSendInput],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-border/10 bg-canvas-surface px-3 py-1.5">
        <TerminalIcon className="size-3.5 text-green-400" />
        <span className="text-xs font-medium text-muted-foreground/70">
          Terminal
        </span>
        <span className="font-mono text-xs text-muted-foreground/40">
          bash
        </span>
        <div className="flex-1" />
        {/* Live connection indicator */}
        {liveConnected !== undefined && (
          <div className="flex items-center gap-1">
            {liveConnected ? (
              <WifiIcon className="size-3 text-green-400" />
            ) : (
              <WifiOffIcon className="size-3 text-muted-foreground/40" />
            )}
            <span className={cn(
              "text-[10px]",
              liveConnected ? "text-green-400" : "text-muted-foreground/40",
            )}>
              {liveConnected ? "Live" : "Static"}
            </span>
          </div>
        )}
        {/* Interactive mode toggle */}
        {onSendInput && liveConnected && (
          <button
            type="button"
            onClick={() => {
              setInteractiveMode((prev) => !prev);
              // Focus the terminal container for keyboard capture
              setTimeout(() => terminalRef.current?.focus(), 0);
            }}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] transition-colors",
              interactiveMode
                ? "bg-green-500/20 text-green-400"
                : "text-muted-foreground/50 hover:bg-muted/20 hover:text-muted-foreground",
            )}
          >
            {interactiveMode ? "Interactive" : "Read-only"}
          </button>
        )}
      </div>

      {/* Terminal output */}
      <div
        ref={terminalRef}
        tabIndex={interactiveMode ? 0 : undefined}
        onKeyDown={interactiveMode ? handleKeyDown : undefined}
        className={cn(
          "flex-1 overflow-auto bg-canvas-deep p-3 font-mono text-xs leading-relaxed terminal-output",
          interactiveMode && "outline-none ring-1 ring-green-500/30",
        )}
      >
        {displayOutput?.map((line, i) => (
          <div key={i} className="text-foreground/80">
            {line.startsWith("$") ? (
              <>
                <span className="text-green-400">ubuntu@sandbox</span>
                <span className="text-muted-foreground/50">:</span>
                <span className="text-blue-400">~</span>
                <span className="text-foreground/80">
                  <AnsiText text={line} />
                </span>
              </>
            ) : (
              <AnsiText text={line} />
            )}
          </div>
        ))}
        {(!displayOutput || displayOutput.length === 0) && (
          <div className="text-muted-foreground/40">
            <span className="text-green-400">ubuntu@sandbox</span>
            <span className="text-muted-foreground/50">:</span>
            <span className="text-blue-400">~</span>
            <span className="text-foreground/80">$ </span>
            <span className="animate-pulse">&#9610;</span>
          </div>
        )}
        {/* Interactive mode indicator */}
        {interactiveMode && (
          <div className="mt-2 text-[10px] text-green-400/60">
            Interactive mode — type to send input. Press Escape to exit.
          </div>
        )}
      </div>
    </div>
  );
}
