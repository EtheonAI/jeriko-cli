"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  SmartphoneIcon,
  ShieldAlertIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  TerminalIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface DeviceInput {
  command?: string;
  require_approval?: boolean;
}

interface DeviceOutput {
  status?: string;
  message?: string;
  command?: string;
  result?: unknown;
  error?: string;
  [key: string]: unknown;
}

/**
 * DeviceCommandRenderer — renders device command results.
 *
 * Handles the `approval_required` status returned by the agent's device_execute
 * when a command matches safety patterns or has require_approval=true.
 * Also shows success/error states for executed commands.
 */
export function DeviceCommandRenderer({
  toolName,
  state,
  input,
  output,
}: ToolRendererProps<DeviceInput, DeviceOutput>) {
  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm">
        <LoaderIcon className="size-4 animate-spin text-blue-500" />
        <span className="text-muted-foreground">
          Executing on device...
        </span>
      </div>
    );
  }

  if (!output || state !== "output-available") return null;

  // Approval required — device safety check triggered
  if (output.status === "approval_required") {
    return (
      <div className="overflow-hidden rounded-lg border border-orange-500/30 bg-orange-500/5">
        <div className="flex items-center gap-2.5 border-b border-orange-500/20 px-3 py-2.5">
          <ShieldAlertIcon className="size-4 text-orange-500" />
          <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
            Device Approval Required
          </span>
        </div>
        <div className="space-y-2 px-3 py-2.5">
          <p className="text-sm text-muted-foreground">{output.message}</p>
          {output.command && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
              <TerminalIcon className="size-3.5 text-muted-foreground/60" />
              <code className="text-xs text-foreground/80">{output.command}</code>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error
  if (output.error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
        <AlertCircleIcon className="size-4 text-destructive" />
        <span className="text-destructive/80">{output.error}</span>
      </div>
    );
  }

  // Success
  return (
    <div className="overflow-hidden rounded-lg border border-green-500/20 bg-green-500/5">
      <div className="flex items-center gap-2 px-3 py-2">
        <CheckCircleIcon className="size-4 text-green-500" />
        <span className="text-sm text-foreground/80">
          Command executed on device
        </span>
      </div>
      {output.result != null && (
        <div className="border-t border-green-500/10 px-3 py-2">
          <pre className="max-h-32 overflow-auto text-xs text-muted-foreground">
            {typeof output.result === "string"
              ? output.result
              : JSON.stringify(output.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
