"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@repo/design-system/components/ui/popover";
import { cn } from "@repo/design-system/lib/utils";
import { CableIcon, CheckIcon, Loader2Icon, PlusIcon } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

// ============================================================================
// Types
// ============================================================================

export interface SelectedConnection {
  id: string;
  type: "app" | "device";
  name: string;
}

interface ConnectionsModalProps {
  disabled?: boolean;
  selectedConnections: SelectedConnection[];
  onToggleConnection: (connection: SelectedConnection) => void;
  onOpenDialog?: () => void;
}

// ============================================================================
// Footer preview icons (popular connectors for the "Add connectors" row)
// ============================================================================

const PREVIEW_ICONS = [
  { name: "GitHub", src: "https://logos.composio.dev/api/github" },
  { name: "Slack", src: "https://logos.composio.dev/api/slack" },
  { name: "Notion", src: "https://logos.composio.dev/api/notion" },
];

const TOTAL_AVAILABLE = 36;

// ============================================================================
// Component
// ============================================================================

export function ConnectionsModal({
  disabled,
  selectedConnections,
  onToggleConnection,
  onOpenDialog,
}: ConnectionsModalProps) {
  const { data: connectors, isLoading } = trpc.connectors.list.useQuery(undefined, {
    retry: 1,
    staleTime: 60_000,
  });

  const isSelected = (id: string) => selectedConnections.some((c) => c.id === id);
  const selectedCount = selectedConnections.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="
            flex items-center gap-[4px] p-[8px]
            cursor-pointer rounded-[100px]
            border border-[#e5e5e5] dark:border-[#333]
            hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.08)]
            transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <div className="flex items-center gap-[4px]">
            {selectedCount > 0 && (
              <span
                className="
                  flex items-center justify-center
                  text-[10px] leading-[10px]
                  h-[16px] min-w-[16px] px-[4px]
                  bg-[#f0f0f0] dark:bg-[#333]
                  rounded-full font-medium
                  text-[#666] dark:text-[#999]
                "
              >
                +{selectedCount}
              </span>
            )}
            <CableIcon
              className="text-[#666] dark:text-[#999]"
              size={16}
              strokeWidth={2}
              aria-hidden="true"
            />
          </div>
          <span className="text-xs text-[#666] dark:text-[#999] whitespace-nowrap pr-1">
            Connectors
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="min-w-[250px] w-max max-w-[400px] p-0 rounded-xl border-[0.5px] border-[#e5e5e5] dark:border-[#333] shadow-[0_4px_11px_0px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_11px_0px_rgba(0,0,0,0.3)]"
      >
        {/* Connector list */}
        <div className="relative flex-1 min-h-0 overflow-y-auto p-[4px]" style={{ maxHeight: 300 }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !connectors || connectors.length === 0 ? (
            <div className="flex items-center justify-center py-6 px-4">
              <p className="text-sm text-muted-foreground text-center">
                No connectors installed yet
              </p>
            </div>
          ) : (
            connectors.map((item) => {
              const name = item.definition?.name ?? item.connector.connectorDefinitionId;
              const iconUrl = item.definition?.icon;
              const isConnected = item.connector.status === "connected";
              const selected = isSelected(item.connector.id);

              return (
                <div
                  key={item.connector.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isConnected) {
                      onToggleConnection({
                        id: item.connector.id,
                        type: "app",
                        name,
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (isConnected) {
                        onToggleConnection({
                          id: item.connector.id,
                          type: "app",
                          name,
                        });
                      }
                    }
                  }}
                  className={cn(
                    "flex items-center gap-[8px] justify-between px-[8px] pl-[4px] h-[36px] rounded-[8px] cursor-pointer select-none",
                    selected ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-center gap-[4px] overflow-hidden">
                    <div className="size-[28px] rounded-[4px] flex items-center justify-center flex-shrink-0">
                      {iconUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          alt={name}
                          src={iconUrl}
                          className="w-[16px] h-[16px]"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <CableIcon className="text-muted-foreground" size={16} />
                      )}
                    </div>
                    <span className="text-foreground text-sm leading-[20px] truncate" title={name}>
                      {name}
                    </span>
                  </div>

                  {selected ? (
                    <CheckIcon className="shrink-0 text-primary size-4" />
                  ) : isConnected ? (
                    <span className="shrink-0 size-1.5 rounded-full bg-green-500" />
                  ) : (
                    <span className="shrink-0 text-muted-foreground text-[14px] leading-[20px]">
                      Connect
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Add connectors */}
        <div className="flex flex-col py-[4px] border-t border-border">
          <div className="px-[4px]">
            <div
              role="button"
              tabIndex={0}
              className="flex items-center justify-between p-[8px] rounded-[8px] hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => onOpenDialog?.()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenDialog?.();
                }
              }}
            >
              <div className="flex items-center gap-[8px]">
                <div className="size-[20px] flex items-center justify-center">
                  <PlusIcon
                    className="text-foreground"
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-[14px] text-foreground">Add connectors</span>
              </div>

              <div className="flex items-center -space-x-1">
                {PREVIEW_ICONS.map((c) => (
                  <div
                    key={c.name}
                    className="size-[24px] rounded-full border border-border bg-background flex items-center justify-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={c.name} src={c.src} className="w-[14px] h-[14px]" />
                  </div>
                ))}
                <div className="size-[24px] rounded-full border border-border bg-background flex items-center justify-center">
                  <span className="text-muted-foreground text-[10px] leading-[16px]">
                    +{TOTAL_AVAILABLE - PREVIEW_ICONS.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
