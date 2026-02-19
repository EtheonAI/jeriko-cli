"use client";

import { Progress } from "@repo/design-system/components/ui/progress";
import { useGetStorageUsageQuery } from "@/lib/store/api/api.slice";
import { formatFileSize } from "@/lib/utils/file-utils";
import { HardDriveIcon } from "lucide-react";

const STORAGE_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB default

export function StorageUsageBar() {
  const { data } = useGetStorageUsageQuery();

  if (!data) return null;

  const percentage = Math.min((data.totalSize / STORAGE_LIMIT) * 100, 100);

  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
      <HardDriveIcon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <Progress value={percentage} className="h-2" />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatFileSize(data.totalSize)} of {formatFileSize(STORAGE_LIMIT)} used
        {" \u00b7 "}
        {data.totalCount} file{data.totalCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
