"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { cn } from "@repo/design-system/lib/utils";
import type { UIMessage } from "../../lib/types/ui-message";
import { MessageItem } from "./message-item";
import { ScrollToBottom } from "./scroll-to-bottom";
import { StreamingIndicator } from "./streaming-indicator";

export interface MessageListProps {
  messages: UIMessage[];
  className?: string;
  isStreaming?: boolean;
  showTypingIndicator?: boolean;
  typingUsers?: string[];
  estimatedItemSize?: number;
  overscan?: number;
  onMessageAction?: (action: string, messageId: string) => void;
  onToolApproval?: (toolCallId: string, approved: boolean, reason?: string) => void;
  renderMessage?: (message: UIMessage, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
}

/**
 * MessageList - Virtualized message list with auto-scroll
 *
 * Uses TanStack Virtual for efficient rendering of large message lists.
 * Automatically scrolls to bottom on new messages while respecting
 * user scroll position.
 */
export function MessageList({
  messages,
  className,
  isStreaming = false,
  showTypingIndicator = false,
  typingUsers = [],
  estimatedItemSize = 100,
  overscan = 5,
  onMessageAction,
  onToolApproval,
  renderMessage,
  emptyState,
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMessageCountRef = useRef(messages.length);

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemSize,
    overscan,
    getItemKey: (index: number) => messages[index]?.id ?? index,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Check if user is at bottom
  const checkIsAtBottom = useCallback(() => {
    const el = parentRef.current;
    if (!el) return true;
    const threshold = 100;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Handle scroll
  const handleScroll = useCallback(() => {
    const atBottom = checkIsAtBottom();
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasNewMessages(false);
    }
  }, [checkIsAtBottom]);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = parentRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      });
      setIsAtBottom(true);
      setHasNewMessages(false);
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      if (isAtBottom) {
        // Use RAF to ensure DOM has updated
        requestAnimationFrame(() => {
          scrollToBottom("smooth");
        });
      } else {
        setHasNewMessages(true);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, isAtBottom, scrollToBottom]);

  // Scroll to bottom on streaming
  useEffect(() => {
    if (isStreaming && isAtBottom) {
      requestAnimationFrame(() => {
        const el = parentRef.current;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    }
  }, [isStreaming, isAtBottom, messages]);

  // Empty state
  if (messages.length === 0 && emptyState) {
    return (
      <div className={cn("flex h-full items-center justify-center", className)}>
        {emptyState}
      </div>
    );
  }

  return (
    <div className={cn("relative h-full", className)}>
      {/* Scrollable container */}
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto"
        style={{ contain: "strict" }}
      >
        {/* Virtual list container */}
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {/* Virtual items */}
          {virtualItems.map((virtualItem: VirtualItem) => {
            const message = messages[virtualItem.index];
            if (!message) return null;

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="px-4 py-2">
                  {renderMessage ? (
                    renderMessage(message, virtualItem.index)
                  ) : (
                    <MessageItem
                      message={message}
                      onAction={onMessageAction}
                      onToolApproval={onToolApproval}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Typing indicator */}
        {(showTypingIndicator || typingUsers.length > 0) && (
          <div className="px-4 py-2">
            <StreamingIndicator
              isActive={isStreaming || typingUsers.length > 0}
              typingUsers={typingUsers}
            />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {!isAtBottom && (
        <ScrollToBottom
          onClick={() => scrollToBottom("smooth")}
          hasNewMessages={hasNewMessages}
        />
      )}
    </div>
  );
}
