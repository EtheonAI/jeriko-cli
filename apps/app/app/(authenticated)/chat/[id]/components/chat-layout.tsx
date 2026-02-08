"use client";

import type { ReactNode } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@repo/design-system/components/ui/resizable";

interface ChatLayoutProps {
  children: ReactNode;
  canvas?: ReactNode;
  filePanel?: ReactNode;
}

export function ChatLayout({ children, canvas, filePanel }: ChatLayoutProps) {
  // No side panels — simple layout
  if (!canvas && !filePanel) {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    );
  }

  // File panel only (no canvas) — fixed width, no resize needed
  if (!canvas && filePanel) {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 flex-1 flex-col">
          {children}
        </div>
        <div className="w-80 shrink-0 overflow-y-auto border-l border-border bg-background/50">
          {filePanel}
        </div>
      </div>
    );
  }

  // Canvas panel — resizable split
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-0 flex-1"
    >
      {/* Chat area */}
      <ResizablePanel
        defaultSize={55}
        minSize={35}
        className="relative flex min-h-0 flex-col"
      >
        {children}
      </ResizablePanel>

      <ResizableHandle withHandle className="border-border/10" />

      {/* Canvas panel */}
      <ResizablePanel
        defaultSize={45}
        minSize={25}
      >
        {canvas}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
