"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { FolderIcon, Loader2Icon } from "lucide-react";
import { useAppDispatch } from "@/lib/store/hooks";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import {
  addProject,
  updateProject,
  type Project,
} from "@/lib/store/slices/projects.slice";
import { toast } from "sonner";

const PROJECT_ICONS = [
  "📁", "🚀", "💡", "🎯", "📊", "🔬", "🎨", "💻",
  "📝", "🏗️", "🌐", "📦", "⚡", "🔧", "📈", "🧪",
  "🎓", "🤖", "📚", "🛠️", "🔍", "🗂️", "💼", "🎯",
];

const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#f43f5e",
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#2563eb", "#1d4ed8",
];

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProject?: Project | null;
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  editProject,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<string | undefined>(undefined);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const dispatch = useAppDispatch();
  const isEditing = !!editProject;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editProject) {
        setName(editProject.name);
        setInstructions(editProject.description ?? "");
        setIcon(editProject.icon ?? undefined);
        setColor(editProject.color ?? undefined);
      } else {
        setName("");
        setInstructions("");
        setIcon(undefined);
        setColor(undefined);
      }
    }
  }, [open, editProject]);

  const [isPending, setIsPending] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const settings: Record<string, unknown> = {};
    if (instructions.trim()) {
      settings.instructions = instructions.trim();
    }

    setIsPending(true);
    try {
      const client = getTrpcClient();
      if (isEditing && editProject) {
        const project = await client.projects.update.mutate({
          id: editProject.id,
          name: trimmedName,
          description: instructions.trim() || undefined,
          icon,
          color,
          settings: Object.keys(settings).length > 0 ? settings : undefined,
        });
        if (project) {
          dispatch(
            updateProject({
              id: project.id,
              updates: {
                name: project.name,
                description: project.description ?? undefined,
                icon: project.icon ?? undefined,
                color: project.color ?? undefined,
                settings: {
                  isPublic: false,
                  allowComments: true,
                  notifyOnUpdate: true,
                },
              },
            })
          );
          toast.success("Project updated");
          onOpenChange(false);
        }
      } else {
        const project = await client.projects.create.mutate({
          name: trimmedName,
          description: instructions.trim() || undefined,
          icon,
          color,
          settings: Object.keys(settings).length > 0 ? settings : undefined,
        });
        if (project) {
          dispatch(
            addProject({
              id: project.id,
              userId: project.userId,
              name: project.name,
              description: project.description ?? undefined,
              icon: project.icon ?? undefined,
              color: project.color ?? undefined,
              type: "general",
              status: "active",
              members: [],
              settings: {
                isPublic: false,
                allowComments: true,
                notifyOnUpdate: true,
              },
              sessionCount: 0,
              fileCount: 0,
              createdAt: new Date(project.createdAt).toISOString(),
              updatedAt: new Date(project.updatedAt).toISOString(),
            })
          );
          toast.success("Project created");
          onOpenChange(false);
        }
      }
    } catch (err: any) {
      toast.error(err?.message ?? (isEditing ? "Failed to update project" : "Failed to create project"));
    } finally {
      setIsPending(false);
    }
  }, [
    name,
    instructions,
    icon,
    color,
    isEditing,
    editProject,
    dispatch,
    onOpenChange,
  ]);
  const canSubmit = name.trim().length > 0 && !isPending;

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[680px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="pt-5 pb-3 px-5">
            <DialogTitle className="text-lg font-semibold">
              {isEditing ? "Edit project" : "Create project"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEditing ? "Edit your project settings" : "Create a new project to organize tasks"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col items-center gap-5 px-5 py-2 overflow-y-auto max-h-[420px]">
            {/* Icon picker */}
            <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="p-4 rounded-2xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                >
                  {icon ? (
                    <span className="text-[32px] leading-none block">{icon}</span>
                  ) : (
                    <FolderIcon
                      className="size-8"
                      style={color ? { color } : undefined}
                    />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-3" align="center">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Icon</p>
                  <div className="grid grid-cols-8 gap-1">
                    {PROJECT_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setIcon(emoji);
                          setIconPickerOpen(false);
                        }}
                        className={`size-8 flex items-center justify-center rounded-md text-base hover:bg-muted transition-colors ${
                          icon === emoji ? "bg-primary/10 ring-1 ring-primary" : ""
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">Color</p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setColor(c);
                          setIcon(undefined);
                          setIconPickerOpen(false);
                        }}
                        className={`size-7 rounded-full transition-transform hover:scale-110 ${
                          color === c && !icon
                            ? "ring-2 ring-offset-2 ring-primary"
                            : ""
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  {(icon || color) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setIcon(undefined);
                        setColor(undefined);
                        setIconPickerOpen(false);
                      }}
                    >
                      Reset to default
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Project name */}
            <div className="w-full space-y-2 shrink-0">
              <label className="text-sm font-medium">Project name</label>
              <Input
                maxLength={200}
                placeholder="Enter the name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Instructions */}
            <div className="w-full space-y-2 flex-1">
              <label className="text-sm font-medium">
                Instructions{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                maxLength={8000}
                placeholder='e.g. "Focus on Python best practices", "Maintain a professional tone", or "Always provide sources for important conclusions".'
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>

            {/* Connectors note */}
            {isEditing && (
              <p className="text-xs text-muted-foreground px-1">
                Manage project connectors from the project page.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-5 shrink-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isPending && <Loader2Icon className="size-4 animate-spin mr-2" />}
              {isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
  );
}
