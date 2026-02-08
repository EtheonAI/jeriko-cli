"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  ChevronDownIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  CircleIcon,
  AlertCircleIcon,
  ClipboardListIcon,
  FileIcon,
  ExternalLinkIcon,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type TaskItemStatus = "complete" | "in-progress" | "pending" | "error";

export interface TaskItemFile {
  name: string;
  path?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  status: TaskItemStatus;
  files?: TaskItemFile[];
}

export interface TaskListProps {
  title?: string;
  tasks: TaskItem[];
  className?: string;
  defaultOpen?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function TaskList({
  title = "Tasks",
  tasks,
  className,
  defaultOpen = true,
}: TaskListProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const completedCount = tasks.filter((t) => t.status === "complete").length;
  const totalTasks = tasks.length;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/40", className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex size-6 items-center justify-center rounded-lg bg-cyan-500/10">
          <ClipboardListIcon className="size-3.5 text-cyan-500" />
        </div>

        <span className="flex-1 text-sm font-medium text-foreground/80">{title}</span>

        {totalTasks > 0 && (
          <span className="text-xs text-muted-foreground/60">
            {completedCount}/{totalTasks}
          </span>
        )}

        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground/50 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div className="h-[2px] w-full bg-muted/30">
          <div
            className="h-full bg-cyan-500/40 transition-all duration-500 ease-out"
            style={{ width: `${totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Tasks */}
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-0 px-3 py-2">
            {tasks.map((task) => (
              <TaskListItem key={task.id} task={task} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Task Item
// ============================================================================

function TaskListItem({ task }: { task: TaskItem }) {
  return (
    <div className="py-1.5">
      <div className="flex items-start gap-2.5">
        <div className="flex size-5 flex-shrink-0 items-center justify-center">
          <TaskStatusIcon status={task.status} />
        </div>
        <span
          className={cn(
            "flex-1 text-sm",
            task.status === "complete" && "text-foreground/60 line-through decoration-muted-foreground/20",
            task.status === "in-progress" && "font-medium text-foreground",
            task.status === "pending" && "text-muted-foreground/50",
            task.status === "error" && "text-red-400"
          )}
        >
          {task.title}
        </span>
      </div>

      {/* Associated files */}
      {task.files && task.files.length > 0 && (
        <div className="ml-7 mt-1 flex flex-wrap gap-1">
          {task.files.map((file, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground/60"
            >
              <FileIcon className="size-2.5" />
              {file.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskStatusIcon({ status }: { status: TaskItemStatus }) {
  switch (status) {
    case "complete":
      return <CheckCircle2Icon className="size-4 text-green-500/70" />;
    case "in-progress":
      return <CircleDotIcon className="size-4 animate-pulse text-cyan-500" />;
    case "pending":
      return <CircleIcon className="size-4 text-muted-foreground/25" />;
    case "error":
      return <AlertCircleIcon className="size-4 text-red-400" />;
  }
}
