"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon, CopyIcon, TerminalIcon } from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface TerminalInput {
  command: string;
  working_directory?: string;
  timeout?: number;
  env?: Record<string, string>;
}

interface TerminalOutput {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  execution_time?: number;
  error?: string;
  signal?: string;
}

export interface TerminalOutputProps extends ToolRendererProps<TerminalInput, TerminalOutput> {}

/**
 * TerminalOutput - Shell command results with ANSI colors
 */
export function TerminalOutput({
  toolName,
  state,
  input,
  output,
}: TerminalOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = input?.command ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Terminal traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="size-3 rounded-full bg-red-500" />
            <div className="size-3 rounded-full bg-yellow-500" />
            <div className="size-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-zinc-400">
            {input?.working_directory ?? "terminal"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-zinc-400 hover:text-zinc-100"
          onClick={handleCopy}
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-green-500" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Terminal content */}
      <div className="bg-zinc-950 p-4 font-mono text-sm">
        {/* Command */}
        <div className="flex items-start gap-2">
          <span className="text-green-400">$</span>
          <span className="text-zinc-100">{input?.command}</span>
        </div>

        {/* Output */}
        {state === "output-available" && output && (
          <div className="mt-3 space-y-2">
            {/* Stdout */}
            {output.stdout && (
              <div className="whitespace-pre-wrap text-zinc-300">
                {parseAnsi(output.stdout)}
              </div>
            )}

            {/* Stderr */}
            {output.stderr && (
              <div className="whitespace-pre-wrap text-red-400">
                {parseAnsi(output.stderr)}
              </div>
            )}

            {/* Error */}
            {output.error && (
              <div className="whitespace-pre-wrap text-red-500">
                Error: {output.error}
              </div>
            )}

            {/* Exit code */}
            <div className="mt-2 flex items-center gap-4 text-xs">
              {output.exit_code !== undefined && (
                <span
                  className={cn(
                    output.exit_code === 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  Exit code: {output.exit_code}
                </span>
              )}
              {output.execution_time !== undefined && (
                <span className="text-zinc-500">
                  {output.execution_time}ms
                </span>
              )}
              {output.signal && (
                <span className="text-yellow-400">
                  Signal: {output.signal}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Parse ANSI escape codes and convert to styled spans
 * This is a simplified parser - a full implementation would use a library
 */
function parseAnsi(text: string): React.ReactNode {
  // Strip ANSI codes for now - in production, use a library like ansi-to-react
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  return stripped;
}
