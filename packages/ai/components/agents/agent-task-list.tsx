"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CheckIcon,
  CircleIcon,
  LoaderIcon,
  XIcon,
  ChevronDownIcon,
} from "lucide-react";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export interface AgentTask {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AgentTaskListProps {
  tasks: AgentTask[];
  className?: string;
  maxVisible?: number;
  showTimestamps?: boolean;
}

/**
 * AgentTaskList - Vertical task progress list
 */
export function AgentTaskList({
  tasks,
  className,
  maxVisible = 5,
  showTimestamps = false,
}: AgentTaskListProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleTasks = expanded ? tasks : tasks.slice(0, maxVisible);
  const hiddenCount = tasks.length - maxVisible;

  return (
    <div className={cn("space-y-1", className)}>
      {visibleTasks.map((task, index) => (
        <TaskItem
          key={task.id}
          task={task}
          isLast={index === visibleTasks.length - 1 && (expanded || hiddenCount <= 0)}
          showTimestamp={showTimestamps}
        />
      ))}

      {hiddenCount > 0 && !expanded && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-full justify-start gap-1 px-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(true)}
        >
          <ChevronDownIcon className="size-3" />
          {hiddenCount} more task{hiddenCount > 1 ? "s" : ""}
        </Button>
      )}

      {expanded && hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-full justify-start gap-1 px-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(false)}
        >
          <ChevronDownIcon className="size-3 rotate-180" />
          Show less
        </Button>
      )}
    </div>
  );
}

function TaskItem({
  task,
  isLast,
  showTimestamp,
}: {
  task: AgentTask;
  isLast: boolean;
  showTimestamp: boolean;
}) {
  const { icon: Icon, color, animate } = getTaskStatusInfo(task.status);

  return (
    <div className="relative flex gap-2">
      {/* Connector line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[7px] top-4 h-full w-0.5",
            task.status === "completed" ? "bg-green-500/50" : "bg-border"
          )}
        />
      )}

      {/* Status icon */}
      <div
        className={cn(
          "relative z-10 flex size-4 flex-shrink-0 items-center justify-center rounded-full",
          color
        )}
      >
        <Icon
          className={cn(
            "size-2.5",
            animate && "animate-spin"
          )}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-2">
        <p
          className={cn(
            "truncate text-xs",
            task.status === "pending" && "text-muted-foreground",
            task.status === "in_progress" && "font-medium text-foreground",
            task.status === "completed" && "text-foreground",
            task.status === "failed" && "text-destructive",
            task.status === "cancelled" && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </p>
        {showTimestamp && task.completedAt && (
          <p className="text-[10px] text-muted-foreground">
            {formatTime(task.completedAt)}
          </p>
        )}
      </div>
    </div>
  );
}

function getTaskStatusInfo(status: TaskStatus): {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  animate: boolean;
} {
  switch (status) {
    case "pending":
      return {
        icon: CircleIcon,
        color: "border border-border bg-background text-muted-foreground",
        animate: false,
      };
    case "in_progress":
      return {
        icon: LoaderIcon,
        color: "bg-primary text-primary-foreground",
        animate: true,
      };
    case "completed":
      return {
        icon: CheckIcon,
        color: "bg-green-500 text-white",
        animate: false,
      };
    case "failed":
      return {
        icon: XIcon,
        color: "bg-destructive text-destructive-foreground",
        animate: false,
      };
    case "cancelled":
      return {
        icon: XIcon,
        color: "bg-muted text-muted-foreground",
        animate: false,
      };
    default:
      return {
        icon: CircleIcon,
        color: "border border-border bg-background text-muted-foreground",
        animate: false,
      };
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
