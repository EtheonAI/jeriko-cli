"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "Failed to load this section. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertCircleIcon className="h-6 w-6 text-destructive" />
      </div>
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCwIcon className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
