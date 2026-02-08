"use client";

import * as React from "react";
import { useRef, useEffect } from "react";
import { TerminalIcon } from "lucide-react";
import { AnsiText } from "../../../lib/ansi";

// ============================================================================
// Types
// ============================================================================

export interface TerminalViewProps {
  output?: string[];
}

// ============================================================================
// Component
// ============================================================================

export function TerminalView({ output }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  // Filter out \x00 marker lines used for dedup
  const visibleLines = output?.filter((line) => !line.startsWith("\x00"));

  return (
    <div className="flex h-full flex-col">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-border/10 bg-canvas-surface px-3 py-1.5">
        <TerminalIcon className="size-3.5 text-green-400" />
        <span className="text-xs font-medium text-muted-foreground/70">Terminal</span>
        <span className="font-mono text-xs text-muted-foreground/40">bash</span>
      </div>

      {/* Terminal output */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-auto bg-canvas-deep p-3 font-mono text-xs leading-relaxed terminal-output"
      >
        {visibleLines?.map((line, i) => (
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
            ) : line.startsWith(">>>") ? (
              <>
                <span className="text-yellow-400">python</span>
                <span className="text-muted-foreground/50">:</span>
                <span className="text-foreground/80">
                  <AnsiText text={line} />
                </span>
              </>
            ) : (
              <AnsiText text={line} />
            )}
          </div>
        ))}
        {(!visibleLines || visibleLines.length === 0) && (
          <div className="text-muted-foreground/40">
            <span className="text-green-400">ubuntu@sandbox</span>
            <span className="text-muted-foreground/50">:</span>
            <span className="text-blue-400">~</span>
            <span className="text-foreground/80">$ </span>
            <span className="animate-pulse">&#9610;</span>
          </div>
        )}
      </div>
    </div>
  );
}
