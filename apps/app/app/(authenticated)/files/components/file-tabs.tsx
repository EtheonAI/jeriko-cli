"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { useAppDispatch, useFileManagement } from "@/lib/store/hooks";
import { setFileTab, type FileTab } from "@/lib/store/slices/fileManagement.slice";
import { getMimeCategory } from "@/lib/utils/file-utils";
import { cn } from "@repo/design-system/lib/utils";

interface FileTabsProps {
  files: Array<{ mimeType: string | null }>;
}

const TABS: { value: FileTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "documents", label: "Documents" },
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "other", label: "Other" },
];

export function FileTabs({ files }: FileTabsProps) {
  const dispatch = useAppDispatch();
  const { fileTab } = useFileManagement();

  const counts = files.reduce<Record<FileTab, number>>(
    (acc, f) => {
      const cat = getMimeCategory(f.mimeType);
      acc[cat]++;
      acc.all++;
      return acc;
    },
    { all: 0, documents: 0, images: 0, videos: 0, audio: 0, other: 0 }
  );

  return (
    <div className="flex gap-1 overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => dispatch(setFileTab(tab.value))}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            fileTab === tab.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {tab.label}
          {counts[tab.value] > 0 && (
            <Badge
              variant={fileTab === tab.value ? "secondary" : "outline"}
              className="ml-0.5 h-5 min-w-5 justify-center px-1 text-xs"
            >
              {counts[tab.value]}
            </Badge>
          )}
        </button>
      ))}
    </div>
  );
}
