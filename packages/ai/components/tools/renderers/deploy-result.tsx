"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ExternalLinkIcon, GlobeIcon, Loader2Icon, RocketIcon } from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface DeployInput {
  port: number;
  name?: string;
}

interface DeployOutput {
  url?: string;
  port?: number;
  message?: string;
  error?: string;
}

export interface DeployResultProps extends ToolRendererProps<DeployInput, DeployOutput> {}

/**
 * DeployResult - Renders deployment results with clickable public URL.
 */
export function DeployResult({ state, input, output }: DeployResultProps) {
  // Loading state
  if (state !== "output-available") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        <span>Deploying port {input?.port ?? "..."}...</span>
      </div>
    );
  }

  // Error state
  if (output?.error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
        <p className="text-sm text-destructive">Deployment failed: {output.error}</p>
      </div>
    );
  }

  // Success
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/20">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <RocketIcon className="size-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {input?.name ?? "App"} is live!
          </p>
          {output?.url && (
            <a
              href={output.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              <GlobeIcon className="size-3.5" />
              <span className="truncate underline">{output.url}</span>
              <ExternalLinkIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          )}
        </div>
      </div>

      {/* Port info */}
      {output?.port && (
        <p className="mt-2 text-xs text-green-600/70 dark:text-green-400/70">
          Port {output.port} → Public URL
        </p>
      )}
    </div>
  );
}
