"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { WifiIcon, WifiOffIcon } from "lucide-react";

interface ConnectionStatusProps {
  isConnected: boolean;
  className?: string;
}

/**
 * ConnectionStatus - WebSocket connection status indicator
 */
export function ConnectionStatus({ isConnected, className }: ConnectionStatusProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
            isConnected
              ? "bg-green-500/10 text-green-600"
              : "bg-red-500/10 text-red-600",
            className
          )}
        >
          <div
            className={cn(
              "size-1.5 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )}
          />
          {isConnected ? (
            <WifiIcon className="size-3" />
          ) : (
            <WifiOffIcon className="size-3" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isConnected ? "Connected" : "Disconnected"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
