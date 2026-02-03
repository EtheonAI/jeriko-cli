"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowDownIcon } from "lucide-react";

export interface ScrollToBottomProps {
  onClick: () => void;
  hasNewMessages?: boolean;
  className?: string;
}

/**
 * ScrollToBottom - Floating button to scroll to latest messages
 */
export function ScrollToBottom({
  onClick,
  hasNewMessages = false,
  className,
}: ScrollToBottomProps) {
  return (
    <div
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 transform",
        className
      )}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={onClick}
        className={cn(
          "gap-2 rounded-full shadow-lg transition-all",
          hasNewMessages && "ring-2 ring-primary ring-offset-2"
        )}
      >
        <ArrowDownIcon className="size-4" />
        {hasNewMessages ? "New messages" : "Scroll to bottom"}
      </Button>
    </div>
  );
}
