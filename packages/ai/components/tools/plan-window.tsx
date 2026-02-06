"use client";

/**
 * PlanWindow — Ported from tool-ui's <Plan> component.
 *
 * Displays step-by-step task progress inline in chat.
 * Supports expand/collapse, staggered animations, celebration state.
 *
 * @see https://tool-ui.com/docs/plan
 */

import * as React from "react";
import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/design-system/components/ui/card";
import { Loader2, Check, X, MoreHorizontal, ChevronRight, ChevronDown, Square } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type PlanTodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface PlanTodo {
  id: string;
  label: string;
  status: PlanTodoStatus;
  description?: string;
}

export interface PlanWindowProps {
  id?: string;
  title?: string;
  description?: string;
  todos: PlanTodo[];
  maxVisibleTodos?: number;
  isActive?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onCancel?: () => void;
  className?: string;
}

// ============================================================================
// TodoIcon — Matches tool-ui exactly
// ============================================================================

function TodoIcon({ status }: { status: PlanTodoStatus }) {
  if (status === "pending") {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card motion-safe:transition-all motion-safe:duration-200"
        aria-hidden="true"
      />
    );
  }

  if (status === "in_progress") {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-[0_0_0_4px_hsl(var(--primary)/0.1)] motion-safe:transition-all motion-safe:duration-300"
        aria-hidden="true"
      >
        <Loader2 className="size-5 text-primary motion-safe:animate-[spin_0.7s_linear_infinite]" />
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary bg-primary shadow-sm motion-safe:animate-[spring-bounce_500ms_cubic-bezier(0.34,1.56,0.64,1)]"
        aria-hidden="true"
      >
        <Check
          className="size-4 text-primary-foreground [&_path]:motion-safe:animate-[check-draw_400ms_cubic-bezier(0.34,1.56,0.64,1)_100ms_backwards]"
          strokeWidth={3}
          style={{ ["--check-path-length" as string]: "24" }}
        />
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-destructive bg-destructive shadow-sm motion-safe:animate-[spring-bounce_500ms_cubic-bezier(0.34,1.56,0.64,1)] dark:border-red-600 dark:bg-red-600"
        aria-hidden="true"
      >
        <X
          className="size-4 text-white [&_path]:motion-safe:animate-[check-draw_400ms_cubic-bezier(0.34,1.56,0.64,1)_100ms_backwards]"
          strokeWidth={3}
          style={{ ["--check-path-length" as string]: "16" }}
        />
      </span>
    );
  }

  return null;
}

// ============================================================================
// PlanTodoItem — With connector line and expandable description
// ============================================================================

interface PlanTodoItemProps {
  todo: PlanTodo;
  className?: string;
  style?: React.CSSProperties;
  showConnector?: boolean;
}

function PlanTodoItem({ todo, className, style, showConnector }: PlanTodoItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  const labelElement = (
    <span
      className={cn(
        "text-sm font-medium leading-6 break-words",
        todo.status === "pending" && "text-muted-foreground",
        todo.status === "in_progress" && "motion-safe:shimmer shimmer-invert text-foreground",
        (todo.status === "completed" || todo.status === "cancelled") && "text-muted-foreground"
      )}
    >
      {todo.label}
    </span>
  );

  // No description — simple row
  if (!todo.description) {
    return (
      <li
        className={cn(
          "relative -mx-2 flex cursor-default items-start gap-3 rounded-md px-2 py-1.5",
          className
        )}
        style={style}
      >
        {showConnector && (
          <div
            className="absolute left-5 top-6 w-px bg-border"
            style={{ height: "calc(100% + 0.25rem)" }}
            aria-hidden="true"
          />
        )}
        <div className="relative z-10">
          <TodoIcon status={todo.status} />
        </div>
        <div className="flex-1 min-w-0">{labelElement}</div>
      </li>
    );
  }

  // With description — expandable
  return (
    <li className={cn("relative -mx-2 cursor-default rounded-md min-w-0", className)} style={style}>
      {showConnector && (
        <div
          className="absolute left-5 top-6 w-px bg-border"
          style={{ height: "calc(100% + 0.25rem)" }}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          "min-w-0 rounded-md motion-safe:transition-all motion-safe:duration-200",
          isOpen && "bg-primary/5"
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="group/todo flex w-full cursor-default items-start gap-3 px-2 py-1.5 text-left"
        >
          <div className="relative z-10">
            <TodoIcon status={todo.status} />
          </div>
          <span className="flex-1 min-w-0">{labelElement}</span>
          <ChevronRight
            className={cn(
              "text-muted-foreground/50 group-hover/todo:text-muted-foreground mt-0.5 size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              isOpen && "rotate-90"
            )}
          />
        </button>
        {isOpen && (
          <div className="motion-safe:animate-[fade-in-stagger_120ms_ease-out_30ms_backwards]">
            <p className="text-muted-foreground pr-2 pb-1.5 pl-11 text-sm text-pretty break-words min-w-0">
              {todo.description}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}

// ============================================================================
// TodoList — Staggered entrance animations
// ============================================================================

interface TodoListProps {
  todos: PlanTodo[];
  newTodoIds: Set<string>;
}

function TodoList({ todos, newTodoIds }: TodoListProps) {
  return (
    <>
      {todos.map((todo, index) => {
        const isNew = newTodoIds.has(todo.id);
        const staggerDelay = isNew ? index * 50 : 0;

        return (
          <PlanTodoItem
            key={todo.id}
            todo={todo}
            showConnector={index < todos.length - 1}
            className={cn(isNew && "motion-safe:animate-[fade-up_300ms_ease-out]")}
            style={
              isNew
                ? { animationDelay: `${staggerDelay}ms`, animationFillMode: "backwards" }
                : undefined
            }
          />
        );
      })}
    </>
  );
}

// ============================================================================
// ProgressBar — With celebration glow at 100%
// ============================================================================

function ProgressBar({ progress, isCelebrating }: { progress: number; isCelebrating: boolean }) {
  return (
    <div className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          progress === 100
            ? "bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 motion-safe:animate-[progress-pulse_600ms_ease-out]"
            : "bg-primary"
        )}
        style={{
          width: `${progress}%`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.2)",
        }}
      />
      {isCelebrating && (
        <div
          className="pointer-events-none absolute inset-0 rounded-full motion-safe:animate-[glow-pulse_600ms_ease-out]"
          style={{ boxShadow: "0 0 20px rgba(16, 185, 129, 0.6)" }}
        />
      )}
    </div>
  );
}

// ============================================================================
// PlanWindow — Main component with collapse/expand support
// ============================================================================

export function PlanWindow({
  id,
  title,
  description,
  todos,
  maxVisibleTodos = 4,
  isActive = false,
  isCollapsed = false,
  onToggleCollapse,
  onCancel,
  className,
}: PlanWindowProps) {
  const seenTodoIds = useRef(new Set<string>());
  const [newTodoIds, setNewTodoIds] = useState<Set<string>>(new Set());
  const isInitialMount = useRef(true);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const prevProgressRef = useRef(0);
  const [showAllHidden, setShowAllHidden] = useState(false);

  const { visibleTodos, hiddenTodos, completedCount, allComplete, progress } = useMemo(() => {
    const completed = todos.filter((t) => t.status === "completed").length;
    return {
      visibleTodos: todos.slice(0, maxVisibleTodos),
      hiddenTodos: todos.slice(maxVisibleTodos),
      completedCount: completed,
      allComplete: completed === todos.length && todos.length > 0,
      progress: todos.length > 0 ? (completed / todos.length) * 100 : 0,
    };
  }, [todos, maxVisibleTodos]);

  // Track new todos for entrance animation
  useEffect(() => {
    const newIds = new Set<string>();
    for (const todo of todos) {
      if (!seenTodoIds.current.has(todo.id)) {
        newIds.add(todo.id);
        seenTodoIds.current.add(todo.id);
      }
    }
    if (newIds.size > 0) {
      setNewTodoIds(newIds);
      const timer = setTimeout(() => setNewTodoIds(new Set()), 500);
      return () => clearTimeout(timer);
    }
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [todos]);

  // Celebration effect when hitting 100%
  useEffect(() => {
    if (progress === 100 && prevProgressRef.current < 100) {
      setIsCelebrating(true);
      const timer = setTimeout(() => setIsCelebrating(false), 1000);
      return () => clearTimeout(timer);
    }
    prevProgressRef.current = progress;
  }, [progress]);

  // Collapsed state — compact strip
  if (isCollapsed) {
    return (
      <Card
        className={cn("w-full overflow-hidden", className)}
        data-tool-ui-id={id}
        data-slot="plan"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50 transition-colors"
        >
          {/* Status indicator */}
          {allComplete ? (
            <Check className="size-4 shrink-0 text-emerald-500" />
          ) : (
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          )}

          <span className="text-sm font-medium truncate flex-1">{title || "Plan"}</span>

          <span className="text-xs text-muted-foreground shrink-0">
            {completedCount}/{todos.length}
          </span>

          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        </button>

        {/* Thin progress bar */}
        <div className="h-0.5 bg-muted">
          <div
            className={cn(
              "h-full transition-all duration-500",
              allComplete
                ? "bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400"
                : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </Card>
    );
  }

  // Expanded state — full plan view matching tool-ui
  return (
    <Card className={cn("w-full gap-4 py-4", className)} data-tool-ui-id={id} data-slot="plan">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          {/* Clickable collapse trigger */}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="shrink-0 p-0.5 hover:bg-accent rounded transition-colors"
              aria-label="Collapse plan"
            >
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
          )}

          {/* Active indicator */}
          {isActive && (
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
          )}

          <CardTitle className="leading-5 font-medium text-pretty text-sm">
            {title || "Plan"}
          </CardTitle>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Stop button */}
          {isActive && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-red-500 transition-colors"
            >
              <Square className="size-3" />
              <span>Stop</span>
            </button>
          )}

          {/* Completion checkmark */}
          {allComplete && <Check className="size-5 shrink-0 text-emerald-500" />}
        </div>
      </CardHeader>

      <CardContent className="px-4 min-w-0">
        <div className="bg-muted/70 rounded-lg px-6 py-4 min-w-0">
          {/* Progress text + bar */}
          <div className="text-muted-foreground mb-2 text-sm">
            {completedCount} of {todos.length} complete
          </div>

          <ProgressBar progress={progress} isCelebrating={isCelebrating} />

          {/* Todo list */}
          <ul className="mt-4 space-y-1 min-w-0">
            <TodoList todos={visibleTodos} newTodoIds={newTodoIds} />

            {/* Overflow: "N more" expandable */}
            {hiddenTodos.length > 0 && (
              <li className="mt-1">
                {!showAllHidden ? (
                  <button
                    type="button"
                    onClick={() => setShowAllHidden(true)}
                    className="text-muted-foreground hover:text-primary flex cursor-default items-center gap-2 py-1 text-sm"
                  >
                    <MoreHorizontal className="text-muted-foreground/70 size-4 shrink-0" />
                    <span>{hiddenTodos.length} more</span>
                  </button>
                ) : (
                  <div className="motion-safe:animate-[fade-in-stagger_120ms_ease-out_30ms_backwards]">
                    <ul className="-mx-2 space-y-1 px-2">
                      <TodoList todos={hiddenTodos} newTodoIds={newTodoIds} />
                    </ul>
                    <button
                      type="button"
                      onClick={() => setShowAllHidden(false)}
                      className="text-muted-foreground hover:text-primary flex cursor-default items-center gap-2 py-1 text-sm mt-1"
                    >
                      <ChevronRight className="text-muted-foreground/70 size-4 shrink-0" />
                      <span>Show less</span>
                    </button>
                  </div>
                )}
              </li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
