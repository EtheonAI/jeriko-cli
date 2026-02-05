"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import {
  FileTextIcon,
  GlobeIcon,
  StickyNoteIcon,
  FileIcon,
  BookmarkIcon,
  Trash2Icon,
  PencilIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";

const typeIcons: Record<string, typeof FileTextIcon> = {
  document: FileTextIcon,
  webpage: GlobeIcon,
  note: StickyNoteIcon,
  file: FileIcon,
  bookmark: BookmarkIcon,
};

const statusColors: Record<string, string> = {
  processing: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  ready: "bg-green-500/10 text-green-600 border-green-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  archived: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

interface ItemDetailDialogProps {
  itemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefetch: () => void;
}

export function ItemDetailDialog({ itemId, open, onOpenChange, onRefetch }: ItemDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const itemQuery = trpc.knowledge.getItem.useQuery({ id: itemId });
  const chunksQuery = trpc.knowledge.getItemChunks.useQuery({ itemId });

  const updateMutation = trpc.knowledge.updateItem.useMutation({
    onSuccess: () => {
      setIsEditing(false);
      itemQuery.refetch();
      onRefetch();
    },
  });

  const deleteMutation = trpc.knowledge.deleteItem.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      onRefetch();
    },
  });

  const item = itemQuery.data;
  const Icon = item ? typeIcons[item.type] || FileIcon : FileIcon;

  function startEdit() {
    if (!item) return;
    setEditName(item.name);
    setEditDescription(item.description ?? "");
    setIsEditing(true);
  }

  function saveEdit() {
    updateMutation.mutate({
      id: itemId,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {itemQuery.isLoading ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              <>
                <Icon className="h-5 w-5 text-muted-foreground" />
                {isEditing ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                ) : (
                  <span>{item?.name}</span>
                )}
                {item && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ml-2 ${statusColors[item.status] ?? ""}`}
                  >
                    {item.status}
                  </Badge>
                )}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {itemQuery.isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : item ? (
            <div className="space-y-4">
              {/* Metadata */}
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Type: {item.type}</span>
                <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    Source URL
                  </a>
                )}
                {item.embeddingModel && <span>Model: {item.embeddingModel}</span>}
              </div>

              {/* Description */}
              {isEditing ? (
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    placeholder="Optional description..."
                  />
                </div>
              ) : item.description ? (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              ) : null}

              {/* Error message */}
              {item.status === "failed" && item.processingError && (
                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-sm text-red-600">Error: {item.processingError}</p>
                </div>
              )}

              {/* Content preview */}
              {item.content && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Content</h4>
                  <pre className="whitespace-pre-wrap text-xs bg-muted rounded-md p-3 max-h-60 overflow-auto font-mono">
                    {item.content.slice(0, 3000)}
                    {item.content.length > 3000 && "..."}
                  </pre>
                </div>
              )}

              {/* Chunks */}
              {chunksQuery.data && chunksQuery.data.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Chunks ({chunksQuery.data.length})</h4>
                  <div className="space-y-2">
                    {chunksQuery.data.slice(0, 5).map((chunk) => (
                      <div key={chunk.id} className="rounded-md border p-2 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground mb-1">
                          <span>Chunk #{chunk.chunkIndex}</span>
                          <span>{chunk.content.length} chars</span>
                        </div>
                        <p className="line-clamp-3">{chunk.content}</p>
                      </div>
                    ))}
                    {chunksQuery.data.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        + {chunksQuery.data.length - 5} more chunks
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2Icon className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete item?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this knowledge item and all its chunks. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate({ id: itemId })}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  <XIcon className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" disabled={updateMutation.isPending} onClick={saveEdit}>
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={startEdit}>
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
