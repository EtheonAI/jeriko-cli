"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  CheckIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

export interface GenericToolProps extends ToolRendererProps {}

/**
 * GenericTool - Fallback JSON tree view for unknown tools
 */
export function GenericTool({
  toolName,
  state,
  input,
  output,
}: GenericToolProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const data = state === "output-available" ? output : input;
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const data = state === "output-available" ? output : input;

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {state === "output-available" ? "Output" : "Input"}
        </span>
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

      {/* JSON tree */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <JsonTree data={data} />
      </div>
    </div>
  );
}

interface JsonTreeProps {
  data: unknown;
  depth?: number;
  path?: string;
}

function JsonTree({ data, depth = 0, path = "root" }: JsonTreeProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (data === null) {
    return <span className="text-orange-500">null</span>;
  }

  if (data === undefined) {
    return <span className="text-gray-500">undefined</span>;
  }

  if (typeof data === "boolean") {
    return <span className="text-purple-500">{data.toString()}</span>;
  }

  if (typeof data === "number") {
    return <span className="text-blue-500">{data}</span>;
  }

  if (typeof data === "string") {
    // Truncate long strings
    const displayValue =
      data.length > 100 ? `${data.slice(0, 100)}...` : data;
    return (
      <span className="text-green-500">
        "{displayValue}"
      </span>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-muted-foreground">[]</span>;
    }

    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDownIcon className="size-3" />
          ) : (
            <ChevronRightIcon className="size-3" />
          )}
          <span className="text-xs">Array[{data.length}]</span>
        </button>
        {expanded && (
          <div className="ml-4 border-l border-border pl-2">
            {data.slice(0, 20).map((item, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground">{index}:</span>
                <JsonTree data={item} depth={depth + 1} path={`${path}[${index}]`} />
              </div>
            ))}
            {data.length > 20 && (
              <span className="text-xs text-muted-foreground">
                ... {data.length - 20} more items
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);

    if (entries.length === 0) {
      return <span className="text-muted-foreground">{"{}"}</span>;
    }

    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDownIcon className="size-3" />
          ) : (
            <ChevronRightIcon className="size-3" />
          )}
          <span className="text-xs">Object{`{${entries.length}}`}</span>
        </button>
        {expanded && (
          <div className="ml-4 border-l border-border pl-2">
            {entries.slice(0, 20).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-xs text-cyan-500">{key}:</span>
                <JsonTree data={value} depth={depth + 1} path={`${path}.${key}`} />
              </div>
            ))}
            {entries.length > 20 && (
              <span className="text-xs text-muted-foreground">
                ... {entries.length - 20} more keys
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-muted-foreground">unknown</span>;
}
