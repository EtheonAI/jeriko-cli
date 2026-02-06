"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";

export interface ChatContainerProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarPosition?: "left" | "right";
  sidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
}

/**
 * ChatContainer - Main layout wrapper for chat interfaces
 *
 * Provides a flexible layout with optional header, footer, and sidebar.
 * The main content area is scrollable while header/footer remain fixed.
 */
export function ChatContainer({
  children,
  className,
  header,
  footer,
  sidebar,
  sidebarPosition = "right",
  sidebarOpen = false,
}: ChatContainerProps) {
  return (
    <div className={cn("flex h-full w-full flex-col overflow-hidden", className)}>
      {/* Header */}
      {header && <div className="flex-shrink-0 border-b border-border bg-background">{header}</div>}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        {sidebar && sidebarPosition === "left" && sidebarOpen && (
          <div className="flex-shrink-0 border-r border-border bg-background/50 backdrop-blur-sm">
            {sidebar}
          </div>
        )}

        {/* Chat content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto">{children}</div>

          {/* Footer (input area) */}
          {footer && <div className="flex-shrink-0 bg-background">{footer}</div>}
        </div>

        {/* Right sidebar */}
        {sidebar && sidebarPosition === "right" && sidebarOpen && (
          <div className="flex-shrink-0 border-l border-border bg-background/50 backdrop-blur-sm">
            {sidebar}
          </div>
        )}
      </div>
    </div>
  );
}
