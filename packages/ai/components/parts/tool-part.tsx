"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import type { StaticToolUIPart, DynamicToolUIPart } from "../../lib/types/ui-message";
import { getToolName } from "../../lib/types/ui-message";
import { ToolCard } from "../tools/tool-card";
import { useToolRegistry } from "../tools/tool-registry";

export interface ToolPartProps {
  part: StaticToolUIPart | DynamicToolUIPart;
  className?: string;
  onApproval?: (toolCallId: string, approved: boolean, reason?: string) => void;
}

/**
 * ToolPart - Wrapper that routes to appropriate tool renderer
 */
export function ToolPart({
  part,
  className,
  onApproval,
}: ToolPartProps) {
  const { getRenderer } = useToolRegistry();
  const toolName = getToolName(part);
  const ToolRenderer = getRenderer(toolName);

  return (
    <ToolCard
      part={part}
      className={className}
      onApproval={onApproval}
    >
      <ToolRenderer
        toolName={toolName}
        toolCallId={part.toolCallId}
        state={part.state}
        input={part.input}
        output={part.output}
        errorText={part.errorText}
      />
    </ToolCard>
  );
}
