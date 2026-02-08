"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Separator } from "@repo/design-system/components/ui/separator";
import type { AgentSession } from "@/lib/store/slices/sessions.slice";

interface TaskDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: AgentSession | null;
  messageCount: number;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TaskDetailsSheet({
  open,
  onOpenChange,
  session,
  messageCount,
}: TaskDetailsSheetProps) {
  if (!session) return null;

  const meta = session.metadata ?? {};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Task Details</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Title
            </label>
            <p className="mt-1 text-sm">{session.title ?? "Untitled"}</p>
          </div>

          <Separator />

          {/* Status */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </label>
            <div className="mt-1.5">
              <Badge
                variant={
                  session.status === "active"
                    ? "default"
                    : session.status === "completed"
                      ? "secondary"
                      : "outline"
                }
              >
                {session.status}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Mode */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Mode
            </label>
            <p className="mt-1 text-sm capitalize">{session.mode ?? "chat"}</p>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Messages
              </label>
              <p className="mt-1 text-sm font-medium">{messageCount}</p>
            </div>
            {session.stats?.tokenCount && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tokens
                </label>
                <p className="mt-1 text-sm font-medium">
                  {session.stats.tokenCount.toLocaleString()}
                </p>
              </div>
            )}
            {session.stats?.toolCallCount && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tool Calls
                </label>
                <p className="mt-1 text-sm font-medium">{session.stats.toolCallCount}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </label>
              <p className="mt-1 text-sm">{formatDate(session.createdAt)}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Last Updated
              </label>
              <p className="mt-1 text-sm">{formatDate(session.updatedAt)}</p>
            </div>
          </div>

          {/* Tags */}
          {session.tags && session.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tags
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {session.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Sharing */}
          {session.isShared && (
            <>
              <Separator />
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sharing
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge variant="secondary">Shared</Badge>
                  {session.sharedWith && (
                    <span className="text-xs text-muted-foreground">
                      with {session.sharedWith.length} people
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Favorite */}
          {session.isFavorite && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Favorite</Badge>
              </div>
            </>
          )}

          {/* Session ID */}
          <Separator />
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Session ID
            </label>
            <p className="mt-1 text-xs font-mono text-muted-foreground break-all">
              {session.id}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
