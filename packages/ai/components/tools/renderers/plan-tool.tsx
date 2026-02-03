"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  CheckIcon,
  ClipboardListIcon,
  CircleIcon,
  LoaderIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface PlanPhase {
  name: string;
  status: "completed" | "in-progress" | "pending";
  tasks?: string[];
}

interface PlanOutput {
  plan?: {
    title?: string;
    phases?: PlanPhase[];
    summary?: string;
  };
  [key: string]: unknown;
}

/**
 * PlanTool - Renders project planning tool output
 */
export function PlanTool({
  toolName,
  state,
  input,
  output,
}: ToolRendererProps<unknown, PlanOutput>) {
  const plan = output?.plan;

  if (state === "input-streaming" || state === "input-available") {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
            Creating plan...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!plan && state !== "output-available") {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ClipboardListIcon className="size-4 text-primary" />
          {plan?.title || "Project Plan"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan?.phases?.map((phase, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center gap-2">
              <PhaseIcon status={phase.status} />
              <span
                className={cn(
                  "text-sm font-medium",
                  phase.status === "completed" && "text-green-600",
                  phase.status === "in-progress" && "text-primary",
                  phase.status === "pending" && "text-muted-foreground"
                )}
              >
                Phase {index + 1}: {phase.name}
              </span>
            </div>
            {phase.tasks && phase.tasks.length > 0 && (
              <div className="ml-6 space-y-1">
                {phase.tasks.map((task, taskIndex) => (
                  <div
                    key={taskIndex}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <CircleIcon className="size-1.5 fill-current" />
                    {task}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {plan?.summary && (
          <p className="text-sm text-muted-foreground">{plan.summary}</p>
        )}
      </CardContent>
    </Card>
  );
}

function PhaseIcon({ status }: { status: PlanPhase["status"] }) {
  switch (status) {
    case "completed":
      return (
        <div className="flex size-5 items-center justify-center rounded-full bg-green-500">
          <CheckIcon className="size-3 text-white" />
        </div>
      );
    case "in-progress":
      return (
        <div className="flex size-5 items-center justify-center rounded-full border-2 border-primary">
          <LoaderIcon className="size-3 animate-spin text-primary" />
        </div>
      );
    case "pending":
    default:
      return (
        <div className="flex size-5 items-center justify-center rounded-full border border-border">
          <CircleIcon className="size-2 text-muted-foreground" />
        </div>
      );
  }
}
