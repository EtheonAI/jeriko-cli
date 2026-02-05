"use client";

import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  removeFromUploadQueue,
  clearUploadQueue,
  type FileManagementState,
} from "@/lib/store/slices/fileManagement.slice";
import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import { XIcon, CheckCircleIcon, AlertCircleIcon, Loader2Icon } from "lucide-react";

export function UploadProgress() {
  const dispatch = useAppDispatch();
  const uploadQueue = useAppSelector(
    (state) => (state.fileManagement as FileManagementState).uploadQueue
  );

  if (uploadQueue.length === 0) return null;

  const allDone = uploadQueue.every((u) => u.status === "completed" || u.status === "failed");

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-lg">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">
          {allDone ? "Uploads complete" : `Uploading ${uploadQueue.length} file(s)`}
        </span>
        {allDone && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => dispatch(clearUploadQueue())}
          >
            <XIcon className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto p-2">
        {uploadQueue.map((item) => (
          <div key={item.id} className="flex items-center gap-2 px-2 py-1.5">
            {item.status === "completed" && (
              <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-green-500" />
            )}
            {item.status === "failed" && (
              <AlertCircleIcon className="h-4 w-4 flex-shrink-0 text-destructive" />
            )}
            {(item.status === "uploading" || item.status === "pending") && (
              <Loader2Icon className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">{item.file}</p>
              {item.status === "uploading" && (
                <Progress value={item.progress} className="mt-1 h-1" />
              )}
              {item.status === "failed" && (
                <p className="text-xs text-destructive">{item.error || "Upload failed"}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 flex-shrink-0"
              onClick={() => dispatch(removeFromUploadQueue(item.id))}
            >
              <XIcon className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
