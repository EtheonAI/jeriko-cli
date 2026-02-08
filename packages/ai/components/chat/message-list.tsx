"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import type { UIMessage } from "../../lib/types/ui-message";
import { MessageItem } from "./message-item";

export interface MessageListProps {
  messages: UIMessage[];
  className?: string;
  isStreaming?: boolean;
  onMessageAction?: (action: string, messageId: string) => void;
  onToolApproval?: (toolCallId: string, approved: boolean, reason?: string) => void;
  onViewInCanvas?: (toolCallId: string) => void;
  renderMessage?: (message: UIMessage, index: number) => React.ReactNode;
  emptyState?: React.ReactNode;
}

/**
 * MessageList - Native-scroll message list with auto-scroll.
 *
 * Uses native scrolling (no virtualizer) for smooth streaming.
 * Auto-scrolls to bottom on new messages and during streaming,
 * but respects the user's scroll position.
 */
export function MessageList({
  messages,
  className,
  isStreaming = false,
  onMessageAction,
  onToolApproval,
  onViewInCanvas,
  renderMessage,
  emptyState,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const prevCountRef = useRef(messages.length);
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  // Check if scroll is near bottom
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
      block: "end",
    });
    setUserScrolled(false);
    setShowScrollBtn(false);
  }, []);

  // Track scroll
  const handleScroll = useCallback(() => {
    const near = isNearBottom();
    if (near) {
      setUserScrolled(false);
      setShowScrollBtn(false);
    } else if (!isStreamingRef.current) {
      setUserScrolled(true);
      setShowScrollBtn(true);
    }
  }, [isNearBottom]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > prevCountRef.current && !userScrolled) {
      requestAnimationFrame(() => scrollToBottom(false));
    }
    prevCountRef.current = messages.length;
  }, [messages.length, userScrolled, scrollToBottom]);

  // Keep at bottom during streaming
  useEffect(() => {
    if (!isStreaming || userScrolled) return;

    // Use MutationObserver for DOM changes during streaming
    const el = scrollRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (!isStreamingRef.current || userScrolled) return;
      el.scrollTop = el.scrollHeight;
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Also scroll now
    el.scrollTop = el.scrollHeight;

    return () => observer.disconnect();
  }, [isStreaming, userScrolled]);

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
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scroll-smooth"
      >
        <div className="mx-auto max-w-3xl px-4 py-6">
          {messages.map((message, index) =>
            renderMessage ? (
              <div key={message.id}>{renderMessage(message, index)}</div>
            ) : (
              <div key={message.id} className="mb-6 last:mb-0">
                <MessageItem
                  message={message}
                  onAction={onMessageAction}
                  onToolApproval={onToolApproval}
                  onViewInCanvas={onViewInCanvas}
                />
              </div>
            )
          )}

          {/* Streaming indicator */}
          {isStreaming && messages.length > 0 && (
            (() => {
              const last = messages[messages.length - 1];
              const hasContent = last?.role === "assistant" && last.parts.length > 0;
              if (hasContent) return null; // Text cursor shows in TextPart
              return (
                <div className="mb-6 flex items-center gap-3 pl-11">
                  <div className="flex items-center gap-1">
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "0ms" }} />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "150ms" }} />
                    <span className="size-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              );
            })()
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-lg backdrop-blur-sm transition-all hover:bg-muted hover:text-foreground"
        >
          <ArrowDownIcon className="size-3.5" />
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
