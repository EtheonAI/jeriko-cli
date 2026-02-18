"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { HistoryIcon } from "lucide-react";
import { useLibraryData } from "@/lib/store/hooks";
import { formatDistanceToNow } from "date-fns";
import { formatFileSize } from "@/lib/utils/file-utils";
import type { FileItem } from "./file-card";

interface VersionHistorySheetProps {
  file: FileItem | null;
  onClose: () => void;
}

export function VersionHistorySheet({ file, onClose }: VersionHistorySheetProps) {
  const { fetchVersions } = useLibraryData({ autoFetch: false });
  const [versions, setVersions] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!file) {
      setVersions(null);
      return;
    }
    setIsLoading(true);
    fetchVersions(file.id)
      .then(() => {
        // fetchVersions dispatches to Redux; for local display we re-query
        import("@/lib/trpc/vanilla").then(({ getTrpcClient }) => {
          getTrpcClient()
            .files.versions.query({ fileId: file.id })
            .then((data) => setVersions(data as any[]))
            .catch(() => setVersions(null))
            .finally(() => setIsLoading(false));
        });
      })
      .catch(() => setIsLoading(false));
  }, [file?.id, fetchVersions]);

  return (
    <Sheet open={!!file} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" />
            Version History
          </SheetTitle>
          {file && <p className="text-sm text-muted-foreground truncate">{file.name}</p>}
        </SheetHeader>
        <div className="mt-6 space-y-1">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : versions && versions.length > 0 ? (
            versions.map((v) => (
              <div key={v.id} className="flex items-start gap-3 rounded-lg border p-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  v{v.version}
                </Badge>
                <div className="min-w-0 flex-1">
                  {v.changeDescription && <p className="text-sm">{v.changeDescription}</p>}
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {v.size != null && <span>{formatFileSize(v.size)}</span>}
                    <span>{formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <HistoryIcon className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No version history</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
