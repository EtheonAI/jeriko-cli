"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { FolderIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";
import type { FileItem } from "./file-card";

interface MoveDialogProps {
  file: FileItem | null;
  folders: FileItem[];
  onClose: () => void;
  onMove: (fileId: string, newPath: string) => void;
}

export function MoveDialog({ file, folders, onClose, onMove }: MoveDialogProps) {
  const [selectedPath, setSelectedPath] = useState("/");

  const handleMove = () => {
    if (file) {
      onMove(file.id, selectedPath);
      onClose();
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move "{file?.name}"</DialogTitle>
        </DialogHeader>
        <div className="mt-2 max-h-64 overflow-y-auto rounded border">
          <button
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
              selectedPath === "/" && "bg-primary/10 font-medium"
            )}
            onClick={() => setSelectedPath("/")}
          >
            <FolderIcon className="h-4 w-4 text-blue-500" />
            Root
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                selectedPath === folder.path + "/" + folder.name && "bg-primary/10 font-medium"
              )}
              onClick={() =>
                setSelectedPath(
                  folder.path === "/" ? `/${folder.name}` : `${folder.path}/${folder.name}`
                )
              }
            >
              <ChevronRightIcon className="h-3 w-3 text-muted-foreground" />
              <FolderIcon className="h-4 w-4 text-blue-500" />
              {folder.name}
            </button>
          ))}
          {folders.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No folders available
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={selectedPath === file?.path}>
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
