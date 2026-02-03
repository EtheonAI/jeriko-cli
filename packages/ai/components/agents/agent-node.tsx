"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Card, CardContent, CardHeader } from "@repo/design-system/components/ui/card";
import {
  BrainIcon,
  SearchIcon,
  CodeIcon,
  GlobeIcon,
  FolderIcon,
  PlayIcon,
  ChartBarIcon,
  BotIcon,
} from "lucide-react";
import { AgentStatusBadge, type AgentStatus } from "./agent-status-badge";
import { AgentTaskList, type AgentTask } from "./agent-task-list";

export type AgentType =
  | "orchestrator"
  | "researcher"
  | "coder"
  | "browser"
  | "file_manager"
  | "executor"
  | "analyst";

export interface AgentData {
  id: string;
  type: AgentType;
  name: string | null;
  status: AgentStatus;
  currentTask: string | null;
  progress: number;
  tasks?: AgentTask[];
  dependsOn?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentNodeProps {
  agent: AgentData;
  className?: string;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

/**
 * AgentNode - Individual agent card with status and tasks
 */
export function AgentNode({
  agent,
  className,
  isSelected = false,
  onClick,
  compact = false,
}: AgentNodeProps) {
  const Icon = getAgentIcon(agent.type);
  const color = getAgentColor(agent.type);

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors",
          isSelected && "border-primary ring-1 ring-primary",
          onClick && "cursor-pointer hover:bg-muted/50"
        )}
      >
        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-md",
            color
          )}
        >
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium">
            {agent.name ?? formatAgentType(agent.type)}
          </span>
        </div>
        <AgentStatusBadge status={agent.status} size="sm" />
      </button>
    );
  }

  return (
    <Card
      className={cn(
        "w-44 overflow-hidden transition-all",
        isSelected && "border-primary ring-1 ring-primary",
        onClick && "cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                color
              )}
            >
              <Icon className="size-4" />
            </div>
            <span className="text-sm font-medium">
              {agent.name ?? formatAgentType(agent.type)}
            </span>
          </div>
          <AgentStatusBadge status={agent.status} />
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        {/* Current task */}
        {agent.currentTask && (
          <p className="mb-2 truncate text-xs text-muted-foreground">
            {agent.currentTask}
          </p>
        )}

        {/* Progress bar */}
        {agent.status !== "idle" && agent.progress > 0 && (
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                agent.status === "completed" ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${agent.progress}%` }}
            />
          </div>
        )}

        {/* Tasks list */}
        {agent.tasks && agent.tasks.length > 0 && (
          <AgentTaskList tasks={agent.tasks} maxVisible={3} />
        )}
      </CardContent>
    </Card>
  );
}

function getAgentIcon(type: AgentType) {
  switch (type) {
    case "orchestrator":
      return BrainIcon;
    case "researcher":
      return SearchIcon;
    case "coder":
      return CodeIcon;
    case "browser":
      return GlobeIcon;
    case "file_manager":
      return FolderIcon;
    case "executor":
      return PlayIcon;
    case "analyst":
      return ChartBarIcon;
    default:
      return BotIcon;
  }
}

function getAgentColor(type: AgentType): string {
  switch (type) {
    case "orchestrator":
      return "bg-purple-500/10 text-purple-500";
    case "researcher":
      return "bg-blue-500/10 text-blue-500";
    case "coder":
      return "bg-green-500/10 text-green-500";
    case "browser":
      return "bg-orange-500/10 text-orange-500";
    case "file_manager":
      return "bg-yellow-500/10 text-yellow-500";
    case "executor":
      return "bg-red-500/10 text-red-500";
    case "analyst":
      return "bg-cyan-500/10 text-cyan-500";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatAgentType(type: AgentType): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
