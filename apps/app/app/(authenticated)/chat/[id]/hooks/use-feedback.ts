"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

/**
 * Persisted 5-star feedback hook.
 * Loads existing votes from DB on mount, saves on change.
 */
export function useFeedback(chatId: string) {
  // messageId → rating (1-5)
  const [feedback, setFeedback] = useState<Record<string, number>>({});

  // Load existing votes from DB
  const { data: existingVotes } = trpc.messages.getVotes.useQuery(
    { chatId },
    { enabled: !!chatId },
  );

  // Hydrate local state from DB on load
  useEffect(() => {
    if (existingVotes && existingVotes.length > 0) {
      const map: Record<string, number> = {};
      for (const v of existingVotes) {
        map[v.messageId] = v.rating;
      }
      setFeedback(map);
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
          // Remove from DB
          removeVoteMutation.mutate(
            { chatId, messageId },
            { onError: () => toast.error("Failed to remove rating") },
          );
          return next;
        }
        // Save to DB
        voteMutation.mutate(
          { chatId, messageId, rating },
          { onError: () => toast.error("Failed to save rating") },
        );
        return { ...prev, [messageId]: rating };
      });
    },
    [chatId, voteMutation, removeVoteMutation],
  );

  return { feedback, handleFeedback };
}
