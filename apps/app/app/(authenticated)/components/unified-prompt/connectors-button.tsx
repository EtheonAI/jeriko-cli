"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { PlugIcon, AppWindowIcon, Loader2Icon } from "lucide-react";
import { useAppSelector } from "@/lib/store/hooks";

interface ConnectorsButtonProps {
  disabled?: boolean;
}

export function ConnectorsButton({ disabled }: ConnectorsButtonProps) {
  const connectors = useAppSelector((state) => state.connectors.installedConnectors);
  const loadingConnectors = useAppSelector((state) => state.connectors.isLoadingInstalled);

  const connectorCount = connectors?.length ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 px-2 rounded-full text-xs text-muted-foreground hover:bg-accent gap-1"
        >
          <PlugIcon className="size-3" />
          <span>Connectors</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl p-0">
        <div className="p-3">
          {loadingConnectors ? (
            <div className="flex items-center justify-center py-4">
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : connectorCount === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No connected apps. Go to Settings to add integrations.
            </p>
          ) : (
            <div className="space-y-1.5">
              {connectors?.map((item) => (
                <div
                  key={item.connectionId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent text-xs"
                >
                  <AppWindowIcon className="size-3.5 text-muted-foreground" />
                  <span className="truncate">{item.name || item.uid}</span>
                  {item.isEnabled && (
                    <span className="size-1.5 rounded-full bg-green-500 ml-auto shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
