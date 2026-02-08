"use client";

import * as React from "react";
import { GlobeIcon, CodeIcon, TerminalIcon, FileTextIcon } from "lucide-react";

// ============================================================================
// Component
// ============================================================================

const capabilities = [
  { icon: GlobeIcon, label: "Browse", color: "text-blue-400" },
  { icon: CodeIcon, label: "Code", color: "text-green-400" },
  { icon: TerminalIcon, label: "Execute", color: "text-emerald-400" },
  { icon: FileTextIcon, label: "Files", color: "text-orange-400" },
];

export function EmptyView() {
  return (
    <div className="flex h-full items-center justify-center bg-canvas-deep">
      <div className="text-center">
        <div className="mx-auto mb-6 grid w-fit grid-cols-2 gap-4">
          {capabilities.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/10 px-6 py-4"
            >
              <Icon className={`size-6 ${color} opacity-60`} />
              <span className="text-[11px] font-medium text-muted-foreground/40">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400/60" />
            <span className="relative inline-flex size-2 rounded-full bg-blue-500/80" />
          </span>
          <p className="text-xs text-muted-foreground/40">
            Rubic&apos;s workspace will appear here...
          </p>
        </div>
      </div>
    </div>
  );
}
