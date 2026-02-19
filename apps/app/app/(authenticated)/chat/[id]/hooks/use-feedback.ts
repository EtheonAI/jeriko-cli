"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  useGetMessageVotesQuery,
  useVoteMessageMutation,
  useRemoveMessageVoteMutation,
} from "@/lib/store/api/api.slice";

/**
 * Persisted 5-star feedback hook.
 * Loads existing votes from DB on mount, saves on change.
 */
export function useFeedback(chatId: string) {
  // messageId → rating (1-5)
  const [feedback, setFeedback] = useState<Record<string, number>>({});
  // Track which ratings are pending save (optimistic)
  const pendingRef = useRef<Set<string>>(new Set());
  const [voteMessage] = useVoteMessageMutation();
  const [removeVote] = useRemoveMessageVoteMutation();

  // Load existing votes via RTK Query
  const { data: existingVotes } = useGetMessageVotesQuery(
    { chatId },
    { skip: !chatId, selectFromResult: ({ data, ...rest }) => ({ data: data as Array<{ messageId: string; rating: number }> | undefined, ...rest }) }
  );

  // Sync loaded votes into local state
  useEffect(() => {
    if (!existingVotes || existingVotes.length === 0) return;
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
  }, [existingVotes]);

  const handleFeedback = useCallback(
    (messageId: string, rating: number) => {
      setFeedback((prev) => {
        // Toggle off if same rating clicked again
        if (prev[messageId] === rating) {
          const next = { ...prev };
          delete next[messageId];
          pendingRef.current.add(messageId);
          removeVote({ chatId, messageId })
            .unwrap()
            .then(() => pendingRef.current.delete(messageId))
            .catch(() => {
              pendingRef.current.delete(messageId);
              toast.error("Failed to remove rating");
            });
          return next;
        }
        // Save to DB — optimistic update via RTK Query
        pendingRef.current.add(messageId);
        voteMessage({ chatId, messageId, rating } as any)
          .unwrap()
          .then(() => pendingRef.current.delete(messageId))
          .catch((error: any) => {
            pendingRef.current.delete(messageId);
            console.error("[useFeedback] Vote save failed:", error);
            toast.error("Failed to save rating");
          });
        return { ...prev, [messageId]: rating };
      });
    },
    [chatId, voteMessage, removeVote]
  );

  return { feedback, handleFeedback };
}
