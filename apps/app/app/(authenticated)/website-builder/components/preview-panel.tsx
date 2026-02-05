"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { RefreshCwIcon, ExternalLinkIcon, MonitorIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

interface PreviewPanelProps {
  projectId: string;
}

export function PreviewPanel({ projectId }: PreviewPanelProps) {
  const startPreview = trpc.websiteBuilder.previewStart.useMutation();
  const { data: previewStatus } = trpc.websiteBuilder.previewStatus.useQuery(
    { projectId },
    {
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "running") return 5000;
        return false;
      },
    }
  );

  const previewUrl = previewStatus?.url;
  const isRunning = previewStatus?.status === "running";

  if (!previewUrl) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-10 items-center justify-between border-b px-3">
          <span className="text-xs font-medium uppercase text-muted-foreground">Preview</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
          <MonitorIcon className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-center text-sm text-muted-foreground">No preview available</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => startPreview.mutate({ projectId })}
            disabled={startPreview.isPending}
          >
            {startPreview.isPending ? "Starting..." : "Start Preview"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center gap-2 border-b px-3">
        <div className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {previewUrl}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => startPreview.mutate({ projectId })}
        >
          <RefreshCwIcon className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
      <div className="flex-1">
        <iframe
          src={previewUrl}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Preview"
        />
      </div>
    </div>
  );
}
