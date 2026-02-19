"use client";

import { useState } from "react";
import { BookOpenIcon, CheckIcon, XIcon, SearchIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Badge } from "@repo/design-system/components/ui/badge";
import { cn } from "@repo/design-system/lib/utils";
import { useAppDispatch, useProducts } from "@/lib/store/hooks";
import {
  setSelectedPlaybookId,
  setShowPlaybookSelector,
} from "@/lib/store/slices/products.slice";
import { setInputPlaybookId } from "@/lib/store/slices/chat.slice";

type PlaybookButtonProps = {
  disabled?: boolean;
};

export function PlaybookButton({ disabled = false }: PlaybookButtonProps) {
  const dispatch = useAppDispatch();
  const { playbookList, selectedPlaybookId, showPlaybookSelector } = useProducts();
  const [search, setSearch] = useState("");

  const selectedPlaybook = playbookList.find((p) => p.id === selectedPlaybookId);

  const filteredPlaybooks = playbookList.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (playbookId: string) => {
    const isSame = selectedPlaybookId === playbookId;
    dispatch(setSelectedPlaybookId(isSame ? null : playbookId));
    dispatch(setInputPlaybookId(isSame ? null : playbookId));
    dispatch(setShowPlaybookSelector(false));
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(setSelectedPlaybookId(null));
    dispatch(setInputPlaybookId(null));
  };

  // Don't render if no playbooks available
  if (playbookList.length === 0) return null;

  return (
    <Popover
      open={showPlaybookSelector}
      onOpenChange={(open) => dispatch(setShowPlaybookSelector(open))}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm",
                "text-muted-foreground hover:text-foreground hover:bg-accent",
                "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                selectedPlaybookId && "text-primary bg-primary/10"
              )}
            >
              <BookOpenIcon className="h-4 w-4" />
              {selectedPlaybook ? (
                <>
                  <span className="max-w-[100px] truncate text-xs">{selectedPlaybook.name}</span>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-accent"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </>
              ) : null}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          {selectedPlaybook ? `Playbook: ${selectedPlaybook.name}` : "Select a playbook"}
        </TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-72 p-0" sideOffset={8}>
        <div className="p-2 border-b">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search playbooks..."
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {filteredPlaybooks.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No playbooks found
            </div>
          ) : (
            filteredPlaybooks.map((playbook) => {
              const isSelected = selectedPlaybookId === playbook.id;
              return (
                <button
                  key={playbook.id}
                  type="button"
                  onClick={() => handleSelect(playbook.id)}
                  className={cn(
                    "w-full flex items-start gap-2.5 rounded-md px-2 py-2 text-left text-sm",
                    "hover:bg-accent transition-colors",
                    isSelected && "bg-accent"
                  )}
                >
                  <span className="text-lg mt-0.5">{playbook.icon || "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{playbook.name}</span>
                      {isSelected && <CheckIcon className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {playbook.description}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {playbook.category}
                      </Badge>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
