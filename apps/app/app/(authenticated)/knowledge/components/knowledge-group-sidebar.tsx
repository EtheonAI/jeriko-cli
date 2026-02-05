"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { FolderIcon, FolderOpenIcon, PlusIcon, Trash2Icon, InboxIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { MoreHorizontalIcon } from "lucide-react";

interface KnowledgeGroup {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}

interface KnowledgeGroupSidebarProps {
  groups: KnowledgeGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  isLoading: boolean;
  onRefetch: () => void;
}

export function KnowledgeGroupSidebar({
  groups,
  selectedGroupId,
  onSelectGroup,
  isLoading,
  onRefetch,
}: KnowledgeGroupSidebarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");

  const createMutation = trpc.knowledge.createGroup.useMutation({
    onSuccess: () => {
      setCreateOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
      onRefetch();
    },
  });

  const deleteMutation = trpc.knowledge.deleteGroup.useMutation({
    onSuccess: () => {
      onSelectGroup(null);
      onRefetch();
    },
  });

  return (
    <div className="flex w-56 flex-col border-r bg-muted/30">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-medium">Groups</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {/* All Items option */}
          <button
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              selectedGroupId === null
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
            onClick={() => onSelectGroup(null)}
          >
            <InboxIcon className="h-4 w-4" />
            <span>All Items</span>
          </button>

          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 mx-1" />)
            : groups.map((group) => (
                <div
                  key={group.id}
                  className={`group flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer ${
                    selectedGroupId === group.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                  onClick={() => onSelectGroup(group.id)}
                >
                  {selectedGroupId === group.id ? (
                    <FolderOpenIcon className="h-4 w-4 shrink-0" />
                  ) : (
                    <FolderIcon className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate flex-1">{group.name}</span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontalIcon className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate({ id: group.id });
                        }}
                      >
                        <Trash2Icon className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
        </div>
      </ScrollArea>

      {/* Create group dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. Project Research"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                placeholder="What is this group for?"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newGroupName.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  name: newGroupName.trim(),
                  description: newGroupDesc.trim() || undefined,
                })
              }
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
