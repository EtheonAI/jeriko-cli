"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { CableIcon, XIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

type ConnectToolsBannerProps = {
  onDismiss?: () => void;
  className?: string;
};

export function ConnectToolsBanner({
  onDismiss,
  className,
}: ConnectToolsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        "bg-muted/30 hover:bg-muted/50",
        "border-x border-b border-border/40",
        "rounded-b-[22px] pb-2 px-5 pt-7 -mt-[22px]",
        "transition-colors cursor-pointer",
        className
      )}
    >
      <Link
        href="/applications"
        className="flex items-center gap-2 group"
      >
        <div className="flex items-center gap-1.5">
          <CableIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        <span className="text-[13px] leading-[18px] text-muted-foreground tracking-tight flex-1 truncate group-hover:text-foreground transition-colors">
          Connect your tools to Rubic
        </span>

        <div className="shrink-0 flex items-center justify-end gap-2">
          {/* Preview icons */}
          <div className="flex items-center gap-0.5">
            <div className="h-5 w-5 rounded bg-muted flex items-center justify-center">
              <span className="text-[10px] font-medium">G</span>
            </div>
            <div className="h-5 w-5 rounded bg-muted flex items-center justify-center">
              <span className="text-[10px] font-medium">S</span>
            </div>
            <div className="h-5 w-5 rounded bg-muted flex items-center justify-center">
              <span className="text-[10px] font-medium">+</span>
            </div>
          </div>

          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDismiss();
            }}
            className="h-6 w-6 hover:bg-background"
          >
            <XIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </Link>
    </div>
  );
}
