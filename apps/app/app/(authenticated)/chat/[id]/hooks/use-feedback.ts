"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getTrpcClient } from "@/lib/trpc/vanilla";

/**
 * Persisted 5-star feedback hook.
 * Loads existing votes from DB on mount, saves on change.
 */
export function useFeedback(chatId: string) {
  // messageId → rating (1-5)
  const [feedback, setFeedback] = useState<Record<string, number>>({});
  // Track which ratings are pending save (optimistic)
  const pendingRef = useRef<Set<string>>(new Set());

  // Load existing votes from DB
  useEffect(() => {
    if (!chatId) return;
    getTrpcClient()
      .messages.getVotes.query({ chatId })
      .then((existingVotes) => {
        if (existingVotes && existingVotes.length > 0) {
          const map: Record<string, number> = {};
          for (const v of existingVotes) {
            map[v.messageId] = v.rating;
          }
          setFeedback((prev) => {
            const merged = { ...map };
            for (const msgId of pendingRef.current) {
              if (prev[msgId] !== undefined) {
                merged[msgId] = prev[msgId];
              }
            }
            return merged;
          });
        }
      })
      .catch(() => {});
  }, [chatId]);

  const handleFeedback = useCallback(
    (messageId: string, rating: number) => {
      setFeedback((prev) => {
        // Toggle off if same rating clicked again
        if (prev[messageId] === rating) {
          const next = { ...prev };
          delete next[messageId];
          pendingRef.current.add(messageId);
          getTrpcClient()
            .messages.removeVote.mutate({ chatId, messageId })
            .then(() => pendingRef.current.delete(messageId))
            .catch(() => {
              pendingRef.current.delete(messageId);
              toast.error("Failed to remove rating");
            });
          return next;
        }
        // Save to DB — optimistic update
        pendingRef.current.add(messageId);
        getTrpcClient()
          .messages.vote.mutate({ chatId, messageId, rating })
          .then(() => pendingRef.current.delete(messageId))
          .catch((error) => {
            pendingRef.current.delete(messageId);
            console.error("[useFeedback] Vote save failed:", error);
            toast.error("Failed to save rating");
          });
        return { ...prev, [messageId]: rating };
      });
    },
    [chatId]
  );

  return { feedback, handleFeedback };
}
