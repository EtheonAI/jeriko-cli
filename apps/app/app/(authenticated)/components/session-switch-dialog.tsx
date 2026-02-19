"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { VirtualList } from "@repo/design-system/components/ui/virtual-list";
import { cn } from "@repo/design-system/lib/utils";
import {
  BotIcon,
  SearchIcon,
  Loader2Icon,
  MessageSquareIcon,
  CloudSunIcon,
  CodeIcon,
  DatabaseIcon,
  MailIcon,
  PaletteIcon,
  ActivityIcon,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  closeSessionSwitch,
  setKeyword,
  setSwitchSessions,
  moveSwitchSelectionUp,
  moveSwitchSelectionDown,
  setSwitchSelectedIndex,
  type SessionSwitchItem,
} from "@/lib/store/slices/sessionSwitch.slice";

// ---------------------------------------------------------------------------
// Icon mapping — matches sidebar chat-item.tsx
// ---------------------------------------------------------------------------

const SESSION_ICON_MAP: Record<string, LucideIcon> = {
  weather: CloudSunIcon,
  email: MailIcon,
  mail: MailIcon,
  code: CodeIcon,
  coding: CodeIcon,
  programming: CodeIcon,
  design: PaletteIcon,
  ui: PaletteIcon,
  data: DatabaseIcon,
  database: DatabaseIcon,
  research: SearchIcon,
  search: SearchIcon,
  meeting: ActivityIcon,
  recording: ActivityIcon,
};

function getSessionIcon(title: string | null): LucideIcon {
  if (!title) return BotIcon;
  const lower = title.toLowerCase();
  for (const [keyword, icon] of Object.entries(SESSION_ICON_MAP)) {
    if (lower.includes(keyword)) return icon;
  }
  return BotIcon;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function formatTimestamp(dateStr: string | undefined): string {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// SessionSwitchDialog
// ---------------------------------------------------------------------------

export function SessionSwitchDialog() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = useAppSelector((state) => state.sessionSwitch.isOpen);
  const keyword = useAppSelector((state) => state.sessionSwitch.keyword);
  const switchSessions = useAppSelector((state) => state.sessionSwitch.sessions);
  const selectedIndex = useAppSelector((state) => state.sessionSwitch.selectedIndex);
  const isLoading = useAppSelector((state) => state.sessionSwitch.isLoading);

  // Pull sessions from the main sessions slice and project into SessionSwitchItem shape
  const allSessions = useAppSelector((state) => state.sessions.sessions);
  const currentSessionId = useAppSelector((state) => state.sessions.currentSessionId);

  // When the dialog opens or the keyword changes, filter and push to sessionSwitch slice
  useEffect(() => {
    if (!isOpen) return;

    const mapped: SessionSwitchItem[] = (Array.isArray(allSessions) ? allSessions : [])
      .filter((s) => s.status !== "archived")
      .map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        mode: s.mode,
        lastActivityAt: s.lastActivityAt,
        updatedAt: s.updatedAt,
        preview: s.description ?? undefined,
      }));

    const filtered = keyword.trim()
      ? mapped.filter(
          (s) =>
            fuzzyMatch(s.title ?? "Untitled", keyword) ||
            (s.preview && fuzzyMatch(s.preview, keyword))
        )
      : mapped;

    // Sort by most recent activity first
    const sorted = [...filtered].sort((a, b) => {
      const aTime = a.lastActivityAt ?? a.updatedAt;
      const bTime = b.lastActivityAt ?? b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    dispatch(setSwitchSessions(sorted));
  }, [isOpen, keyword, allSessions, dispatch]);

  // Focus the input when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay so Radix has time to render the portal
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    dispatch(closeSessionSwitch());
  }, [dispatch]);

  const handleKeywordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setKeyword(e.target.value));
    },
    [dispatch]
  );

  const handleNavigate = useCallback(
    (sessionId: string) => {
      dispatch(closeSessionSwitch());
      router.push(`/chat/${sessionId}`);
    },
    [dispatch, router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          dispatch(moveSwitchSelectionDown());
          break;
        case "ArrowUp":
          e.preventDefault();
          dispatch(moveSwitchSelectionUp());
          break;
        case "Enter": {
          e.preventDefault();
          const target = switchSessions[selectedIndex];
          if (target) {
            handleNavigate(target.id);
          }
          break;
        }
        // Esc is handled by Radix Dialog onOpenChange
      }
    },
    [dispatch, switchSessions, selectedIndex, handleNavigate]
  );

  // Keep selected item in view
  const selectedItemRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Render a single session row
  const renderSessionItem = useCallback(
    (item: SessionSwitchItem, index: number) => {
      const Icon = getSessionIcon(item.title);
      const isSelected = index === selectedIndex;
      const isCurrent = item.id === currentSessionId;
      const displayTitle = item.title || "Untitled";
      const timestamp = formatTimestamp(item.lastActivityAt ?? item.updatedAt);

      return (
        <div
          ref={isSelected ? selectedItemRef : undefined}
          role="option"
          aria-selected={isSelected}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors",
            isSelected
              ? "bg-accent text-accent-foreground"
              : "hover:bg-muted/50"
          )}
          onClick={() => handleNavigate(item.id)}
          onMouseEnter={() => dispatch(setSwitchSelectedIndex(index))}
        >
          {/* Icon */}
          <div
            className={cn(
              "flex items-center justify-center size-8 rounded-md shrink-0",
              isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="size-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{displayTitle}</span>
              {isCurrent && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                  Current
                </span>
              )}
            </div>
            {item.preview && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {item.preview}
              </p>
            )}
          </div>

          {/* Timestamp */}
          {timestamp && (
            <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
              {timestamp}
            </span>
          )}
        </div>
      );
    },
    [selectedIndex, currentSessionId, handleNavigate, dispatch]
  );

  const getItemKey = useCallback(
    (index: number) => switchSessions[index]?.id ?? index,
    [switchSessions]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-[560px] p-0 gap-0 overflow-hidden rounded-xl"
        showCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Switch session</DialogTitle>
        <DialogDescription className="sr-only">
          Search and switch between chat sessions
        </DialogDescription>

        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <SearchIcon className="size-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={keyword}
            onChange={handleKeywordChange}
            placeholder="Search sessions..."
            className="border-0 shadow-none focus-visible:ring-0 h-8 px-0 text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
            esc
          </kbd>
        </div>

        {/* Session list */}
        <div className="px-2 py-2" role="listbox">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : switchSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquareIcon className="size-8 mb-2 opacity-40" />
              <p className="text-sm">
                {keyword.trim() ? "No sessions match your search" : "No sessions yet"}
              </p>
            </div>
          ) : switchSessions.length <= 20 ? (
            // For small lists, render directly without virtualization
            <div className="max-h-[380px] overflow-y-auto">
              {switchSessions.map((item, index) => (
                <div key={item.id}>{renderSessionItem(item, index)}</div>
              ))}
            </div>
          ) : (
            // For large lists, use virtualization
            <VirtualList
              items={switchSessions}
              renderItem={renderSessionItem}
              estimateSize={56}
              overscan={5}
              className="h-[380px]"
              getItemKey={getItemKey}
            />
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              &uarr;
            </kbd>
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              &darr;
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              enter
            </kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
              esc
            </kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
