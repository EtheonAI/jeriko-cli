"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Progress } from "@repo/design-system/components/ui/progress";
import {
  CheckCircleIcon,
  CircleIcon,
  ClockIcon,
  LoaderIcon,
  AlertCircleIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

interface ProgressStep {
  step: number;
  title: string;
  status: "completed" | "in-progress" | "pending" | "error";
  duration?: string;
  progress?: number;
  error?: string;
}

interface ProgressOutput {
  steps?: ProgressStep[];
  overallProgress?: number;
  estimatedCompletion?: string;
  currentStep?: string;
  [key: string]: unknown;
}

/**
 * ProgressTool - Renders step-by-step progress tracking
 */
export function ProgressTool({
  toolName,
  state,
  input,
  output,
}: ToolRendererProps<unknown, ProgressOutput>) {
  if (state === "input-streaming" || state === "input-available") {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
            Tracking progress...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!output || state !== "output-available") {
    return null;
  }

  const { steps, overallProgress, estimatedCompletion } = output;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ClockIcon className="size-4 text-primary" />
            Progress Tracker
          </CardTitle>
          {overallProgress !== undefined && (
            <span className="text-sm font-medium text-primary">
              {overallProgress}%
            </span>
          )}
        </div>
        {overallProgress !== undefined && (
          <Progress value={overallProgress} className="h-2" />
        )}
        {estimatedCompletion && (
          <p className="text-xs text-muted-foreground">
            Estimated completion: {estimatedCompletion}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {steps?.map((step, index) => (
          <StepItem key={index} step={step} />
        ))}
      </CardContent>
    </Card>
  );
}

function StepItem({ step }: { step: ProgressStep }) {
  return (
    <div className="flex items-start gap-3">
      <StepIcon status={step.status} />
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-sm",
              step.status === "completed" && "text-foreground",
              step.status === "in-progress" && "font-medium text-primary",
              step.status === "pending" && "text-muted-foreground",
              step.status === "error" && "text-destructive"
            )}
          >
            {step.step}. {step.title}
          </span>
          {step.duration && step.status === "completed" && (
            <span className="text-xs text-muted-foreground">{step.duration}</span>
          )}
        </div>
        {step.status === "in-progress" && step.progress !== undefined && (
          <Progress value={step.progress} className="h-1" />
        )}
        {step.error && (
          <p className="text-xs text-destructive">{step.error}</p>
        )}
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: ProgressStep["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircleIcon className="size-5 text-green-500" />;
    case "in-progress":
      return <LoaderIcon className="size-5 animate-spin text-primary" />;
    case "error":
      return <AlertCircleIcon className="size-5 text-destructive" />;
    case "pending":
    default:
      return <CircleIcon className="size-5 text-muted-foreground" />;
  }
}
