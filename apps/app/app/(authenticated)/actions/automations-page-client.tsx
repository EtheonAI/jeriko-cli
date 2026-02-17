"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  ZapIcon,
  RepeatIcon,
  ClockIcon,
  CodeIcon,
  PlusIcon,
  SearchIcon,
  ListTodoIcon,
} from "lucide-react";
import { useScheduledTasksData } from "@/lib/store/hooks/useScheduledTasksData";
import type { ScheduledTask } from "@/lib/store/slices/scheduledTasks.slice";
import { AutomationCard } from "./components/automation-card";
import { CreateAutomationDialog } from "./components/create-automation-dialog";
import { EditAutomationDialog } from "./components/edit-automation-dialog";
import { ExecutionHistorySheet } from "./components/execution-history-sheet";

function EmptyState({
  icon: Icon,
  title,
  description,
  onAction,
  actionLabel,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-center text-sm text-muted-foreground max-w-sm">{description}</p>
      {onAction && actionLabel && (
        <Button className="mt-6 gap-2" onClick={onAction}>
          <PlusIcon className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function AutomationsPageClient() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "all";

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { tasks, isLoading, error, refetch } = useScheduledTasksData();

  // Find the task name for the history sheet
  const historyTaskName = useMemo(
    () => tasks.find((t) => t.id === historyTaskId)?.name ?? "Automation",
    [tasks, historyTaskId]
  );

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.triggerAppName?.toLowerCase().includes(q) ||
        t.triggerEventSlug?.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  // Split by type
  const triggerTasks = useMemo(
    () => filteredTasks.filter((t) => t.scheduleType === "trigger"),
    [filteredTasks]
  );
  const scheduleTasks = useMemo(
    () => filteredTasks.filter((t) => t.scheduleType === "recurring" || t.scheduleType === "cron"),
    [filteredTasks]
  );
  const onceTasks = useMemo(
    () => filteredTasks.filter((t) => t.scheduleType === "once"),
    [filteredTasks]
  );

  function renderTaskList(taskList: ScheduledTask[], emptyIcon: React.ElementType, emptyTitle: string, emptyDescription: string) {
    if (isLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
            Retry
          </Button>
        </div>
      );
    }

    if (taskList.length === 0) {
      return (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          onAction={() => setIsCreateOpen(true)}
          actionLabel="Create Automation"
        />
      );
    }

    return (
      <div className="space-y-3">
        {taskList.map((task) => (
          <AutomationCard
            key={task.id}
            task={task}
            onEdit={setEditingTask}
            onViewHistory={setHistoryTaskId}
            onRefetch={refetch}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Automations</h1>
            <p className="text-muted-foreground">
              Create and manage automated tasks triggered by events or schedules
            </p>
          </div>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            Create Automation
          </Button>
        </div>

        {/* Search */}
        <div className="mb-4 relative max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col">
          <TabsList className="w-fit">
            <TabsTrigger value="all" className="gap-2">
              <ListTodoIcon className="h-4 w-4" />
              All
              {tasks.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">({filteredTasks.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="triggers" className="gap-2">
              <ZapIcon className="h-4 w-4" />
              Triggers
              {triggerTasks.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">({triggerTasks.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedules" className="gap-2">
              <RepeatIcon className="h-4 w-4" />
              Schedules
              {scheduleTasks.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">({scheduleTasks.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="one-time" className="gap-2">
              <ClockIcon className="h-4 w-4" />
              One-time
              {onceTasks.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">({onceTasks.length})</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="flex-1 flex flex-col mt-6">
            {renderTaskList(
              filteredTasks,
              ListTodoIcon,
              "No automations yet",
              "Create your first automation to run tasks on a schedule or triggered by events from your connected apps."
            )}
          </TabsContent>

          <TabsContent value="triggers" className="flex-1 flex flex-col mt-6">
            {renderTaskList(
              triggerTasks,
              ZapIcon,
              "No trigger automations",
              "Trigger automations run when events occur in your connected apps, like receiving an email or a new GitHub issue."
            )}
          </TabsContent>

          <TabsContent value="schedules" className="flex-1 flex flex-col mt-6">
            {renderTaskList(
              scheduleTasks,
              RepeatIcon,
              "No scheduled automations",
              "Scheduled automations run on a recurring basis — daily, weekly, or on a custom cron schedule."
            )}
          </TabsContent>

          <TabsContent value="one-time" className="flex-1 flex flex-col mt-6">
            {renderTaskList(
              onceTasks,
              ClockIcon,
              "No one-time automations",
              "One-time automations run once at a specified date and time."
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateAutomationDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <EditAutomationDialog
        task={editingTask}
        open={editingTask !== null}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
      />
      <ExecutionHistorySheet
        taskId={historyTaskId}
        taskName={historyTaskName}
        open={historyTaskId !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryTaskId(null);
        }}
      />
    </>
  );
}
