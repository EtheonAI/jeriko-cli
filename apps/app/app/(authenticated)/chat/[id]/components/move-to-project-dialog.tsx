"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Input } from "@repo/design-system/components/ui/input";
import { FolderIcon, CheckIcon, SearchIcon, PlusIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

interface MoveToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  currentProjectId?: string | null;
  onMoved?: (projectId: string, projectName: string) => void;
}

export function MoveToProjectDialog({
  open,
  onOpenChange,
  sessionId,
  currentProjectId,
  onMoved,
}: MoveToProjectDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(currentProjectId ?? null);

  const { data: projects, isLoading } = trpc.projects.list.useQuery(
    { status: "active", limit: 50 },
    { enabled: open }
  );

  const addSession = trpc.projects.addSession.useMutation({
    onSuccess: () => {
      const project = projects?.find((p) => p.id === selectedId);
      toast.success(`Moved to ${project?.name ?? "project"}`);
      onMoved?.(selectedId!, project?.name ?? "Project");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to move to project");
    },
  });

  const handleMove = () => {
    if (!selectedId) return;
    addSession.mutate({ projectId: selectedId, sessionId });
  };

  const filtered = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to Project</DialogTitle>
          <DialogDescription>
            Select a project to move this conversation to.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Project list */}
        <ScrollArea className="max-h-[280px]">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading projects...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {search ? "No projects found" : "No projects yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedId(project.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    selectedId === project.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: project.color
                        ? `${project.color}20`
                        : undefined,
                    }}
                  >
                    {project.icon ? (
                      <span className="text-sm">{project.icon}</span>
                    ) : (
                      <FolderIcon
                        className="h-4 w-4"
                        style={{ color: project.color ?? undefined }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {project.description}
                      </p>
                    )}
                  </div>
                  {selectedId === project.id && (
                    <CheckIcon className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={!selectedId || addSession.isPending}>
            {addSession.isPending ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
