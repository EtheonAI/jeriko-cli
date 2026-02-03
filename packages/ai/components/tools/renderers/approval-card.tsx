"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  ShieldAlertIcon,
  CheckIcon,
  XIcon,
  ChevronDownIcon,
} from "lucide-react";

export interface ApprovalCardProps {
  toolName: string;
  toolCallId: string;
  input: unknown;
  title?: string;
  onApprove: (reason?: string) => void;
  onDeny: (reason?: string) => void;
  className?: string;
}

/**
 * ApprovalCard - User approval request for tool execution
 */
export function ApprovalCard({
  toolName,
  toolCallId,
  input,
  title,
  onApprove,
  onDeny,
  className,
}: ApprovalCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [reason, setReason] = useState("");
  const [showReasonInput, setShowReasonInput] = useState(false);

  const handleApprove = () => {
    onApprove(reason || undefined);
  };

  const handleDeny = () => {
    if (!showReasonInput) {
      setShowReasonInput(true);
      return;
    }
    onDeny(reason || undefined);
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border-2 border-orange-500/50 bg-orange-500/5",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-orange-500/20 px-4 py-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
          <ShieldAlertIcon className="size-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium">Approval Required</h3>
          <p className="text-sm text-muted-foreground">
            {title ?? formatToolName(toolName)} wants to execute
          </p>
        </div>
      </div>

      {/* Input details */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex w-full items-center justify-between px-4 py-2 text-sm text-muted-foreground hover:bg-orange-500/5"
        >
          <span>View details</span>
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform",
              showDetails && "rotate-180"
            )}
          />
        </button>
        {showDetails && (
          <div className="border-t border-orange-500/20 px-4 py-3">
            <pre className="max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-xs">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Reason input */}
      {showReasonInput && (
        <div className="border-t border-orange-500/20 px-4 py-3">
          <Textarea
            placeholder="Reason for denial (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 border-t border-orange-500/20 p-3">
        <Button
          variant="outline"
          className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-500"
          onClick={handleDeny}
        >
          <XIcon className="mr-2 size-4" />
          {showReasonInput ? "Confirm Deny" : "Deny"}
        </Button>
        <Button
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={handleApprove}
        >
          <CheckIcon className="mr-2 size-4" />
          Approve
        </Button>
      </div>
    </div>
  );
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
