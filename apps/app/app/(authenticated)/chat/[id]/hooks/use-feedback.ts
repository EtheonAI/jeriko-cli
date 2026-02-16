"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

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
  const { data: existingVotes } = trpc.messages.getVotes.useQuery(
    { chatId },
    { enabled: !!chatId }
  );

  // Sync from DB whenever votes load/change — but don't overwrite pending optimistic updates
  useEffect(() => {
    if (existingVotes && existingVotes.length > 0) {
      const map: Record<string, number> = {};
      for (const v of existingVotes) {
        map[v.messageId] = v.rating;
      }
      setFeedback((prev) => {
        // Merge DB data with any pending optimistic updates
        const merged = { ...map };
        for (const msgId of pendingRef.current) {
          if (prev[msgId] !== undefined) {
            merged[msgId] = prev[msgId];
          }
        }
        return merged;
      });
    }
  }, [existingVotes]);

  // Mutations
  const voteMutation = trpc.messages.vote.useMutation();
  const removeVoteMutation = trpc.messages.removeVote.useMutation();

  const handleFeedback = useCallback(
    (messageId: string, rating: number) => {
      setFeedback((prev) => {
        // Toggle off if same rating clicked again
        if (prev[messageId] === rating) {
          const next = { ...prev };
          delete next[messageId];
          pendingRef.current.add(messageId);
          removeVoteMutation.mutate(
            { chatId, messageId },
            {
              onSettled: () => pendingRef.current.delete(messageId),
              onError: () => toast.error("Failed to remove rating"),
            }
          );
          return next;
        }
        // Save to DB — optimistic update
        pendingRef.current.add(messageId);
        voteMutation.mutate(
          { chatId, messageId, rating },
          {
            onSettled: () => pendingRef.current.delete(messageId),
            onError: (error) => {
              console.error("[useFeedback] Vote save failed:", error);
              toast.error("Failed to save rating");
            },
          }
        );
        return { ...prev, [messageId]: rating };
      });
    },
    [chatId, voteMutation, removeVoteMutation]
  );

  return { feedback, handleFeedback };
}
