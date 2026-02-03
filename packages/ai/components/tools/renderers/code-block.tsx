"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon, CopyIcon, PlayIcon, TerminalIcon } from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface CodeInput {
  code: string;
  language?: string;
  filename?: string;
}

interface CodeOutput {
  stdout?: string;
  stderr?: string;
  result?: unknown;
  exit_code?: number;
  execution_time?: number;
  error?: string;
}

export interface CodeBlockProps extends ToolRendererProps<CodeInput, CodeOutput> {}

/**
 * CodeBlock - Syntax highlighted code with execution results
 */
export function CodeBlock({
  toolName,
  state,
  input,
  output,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const language = input?.language ?? detectLanguage(input?.code ?? "");
  const code = input?.code ?? "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Code block */}
      <div className="overflow-hidden rounded-lg border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <TerminalIcon className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {input?.filename ?? language}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleCopy}
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-green-500" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Code content */}
        <pre className="overflow-x-auto bg-zinc-950 p-4 dark:bg-zinc-900">
          <code className="text-sm text-zinc-100">
            {code.split("\n").map((line, i) => (
              <div key={i} className="flex">
                <span className="mr-4 w-8 select-none text-right text-zinc-500">
                  {i + 1}
                </span>
                <span>{line || " "}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* Output */}
      {state === "output-available" && output && (
        <div className="space-y-2">
          {/* Stdout */}
          {output.stdout && (
            <OutputBlock
              label="Output"
              content={output.stdout}
              variant="success"
            />
          )}

          {/* Stderr */}
          {output.stderr && (
            <OutputBlock
              label="Stderr"
              content={output.stderr}
              variant="warning"
            />
          )}

          {/* Error */}
          {output.error && (
            <OutputBlock
              label="Error"
              content={output.error}
              variant="error"
            />
          )}

          {/* Result */}
          {output.result !== undefined && (
            <OutputBlock
              label="Result"
              content={
                typeof output.result === "string"
                  ? output.result
                  : JSON.stringify(output.result, null, 2)
              }
              variant="success"
            />
          )}

          {/* Execution info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {output.exit_code !== undefined && (
              <span>
                Exit code:{" "}
                <span
                  className={cn(
                    "font-medium",
                    output.exit_code === 0 ? "text-green-500" : "text-red-500"
                  )}
                >
                  {output.exit_code}
                </span>
              </span>
            )}
            {output.execution_time !== undefined && (
              <span>Execution time: {output.execution_time}ms</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OutputBlock({
  label,
  content,
  variant,
}: {
  label: string;
  content: string;
  variant: "success" | "warning" | "error";
}) {
  const bgColor = {
    success: "bg-green-500/10 border-green-500/20",
    warning: "bg-yellow-500/10 border-yellow-500/20",
    error: "bg-red-500/10 border-red-500/20",
  }[variant];

  const textColor = {
    success: "text-green-600 dark:text-green-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
  }[variant];

  return (
    <div className={cn("rounded-lg border p-3", bgColor)}>
      <span className={cn("text-xs font-medium", textColor)}>{label}</span>
      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-sm">
        {content}
      </pre>
    </div>
  );
}

function detectLanguage(code: string): string {
  // Simple heuristics
  if (code.includes("import ") && code.includes("from ")) return "python";
  if (code.includes("def ") && code.includes(":")) return "python";
  if (code.includes("function ") || code.includes("const ") || code.includes("let ")) return "javascript";
  if (code.includes("interface ") || code.includes(": string") || code.includes(": number")) return "typescript";
  if (code.includes("package ") && code.includes("func ")) return "go";
  if (code.includes("fn ") && code.includes("->")) return "rust";
  if (code.includes("public class ") || code.includes("private ")) return "java";
  if (code.includes("<?php")) return "php";
  if (code.includes("<!DOCTYPE") || code.includes("<html")) return "html";
  if (code.includes("{") && code.includes(":") && !code.includes("function")) return "json";
  return "text";
}
