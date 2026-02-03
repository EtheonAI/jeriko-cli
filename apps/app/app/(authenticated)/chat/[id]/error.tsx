"use client";

import { useEffect } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ChatError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error("Chat page error:", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircleIcon className="size-8 text-destructive" />
      </div>

      <div className="text-center">
        <h2 className="text-lg font-medium">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while loading the chat."}
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCwIcon className="mr-2 size-4" />
          Reload page
        </Button>
        <Button onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
