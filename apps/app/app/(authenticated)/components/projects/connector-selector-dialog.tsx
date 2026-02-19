"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { SearchIcon, CheckIcon } from "lucide-react";
import { useGetInstalledConnectorsQuery } from "@/lib/store/api/api.slice";

type ConnectorSelectorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
};

export function ConnectorSelectorDialog({
  open,
  onOpenChange,
  selectedIds,
  onSelect,
}: ConnectorSelectorDialogProps) {
  const [search, setSearch] = useState("");
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);

  // RTK Query for installed connectors — skip when dialog is closed
  const { data: connectors = null, isLoading } = useGetInstalledConnectorsQuery(undefined, {
    skip: !open,
    selectFromResult: ({ data, ...rest }) => ({ data: (data as any[] | undefined) ?? null, ...rest }),
  });

  // Sync local state with parent when opening
  useEffect(() => {
    if (open) setLocalSelected(selectedIds);
  }, [open, selectedIds]);

  const filteredConnectors = useMemo(() => {
    if (!connectors) return [];
    const query = search.toLowerCase();
    return connectors.filter((c) =>
      c.definition.name.toLowerCase().includes(query) ||
      c.definition.description?.toLowerCase().includes(query)
    );
  }, [connectors, search]);

  const toggleConnector = useCallback((id: string) => {
    setLocalSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleSave = useCallback(() => {
    onSelect(localSelected);
    onOpenChange(false);
  }, [localSelected, onSelect, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="pt-5 pb-3 px-5">
          <DialogTitle className="text-lg font-semibold">
            Power your project with connectors
          </DialogTitle>
          <DialogDescription className="sr-only">
            Select which connected apps this project can use
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0 px-5">
          {/* Search */}
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search connectors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Connector list */}
          <ScrollArea className="max-h-[340px] -mx-1 px-1">
            {isLoading ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredConnectors.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "No connectors found"
                    : connectors && connectors.length === 0
                      ? "No connected apps yet. Connect apps in Settings first."
                      : "No matching connectors"}
                </p>
              </div>
            ) : (
              <div className="space-y-1 py-1">
                {filteredConnectors.map((c) => {
                  const isSelected = localSelected.includes(c.connector.id);
                  return (
                    <button
                      key={c.connector.id}
                      type="button"
                      onClick={() => toggleConnector(c.connector.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      {c.definition.icon ? (
                        <img
                          src={c.definition.icon}
                          alt=""
                          className="size-8 rounded-md object-contain"
                        />
                      ) : (
                        <div className="size-8 rounded-md bg-muted flex items-center justify-center text-xs font-medium">
                          {c.definition.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {c.definition.name}
                        </p>
                        {c.definition.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {c.definition.description}
                          </p>
                        )}
                      </div>
                      <div
                        className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <CheckIcon className="size-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="p-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Done{localSelected.length > 0 ? ` (${localSelected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
