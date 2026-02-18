"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setAgentEmailInfo,
  setEmailWhiteList,
  setAgentSubEmails,
  addToWhitelist,
  removeFromWhitelist,
  setIsLoading,
  setIsSaving,
  setError,
  saveEmailEdits,
  type AgentEmailWhiteListInfo,
} from "../slices/mailAgent.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";

function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }
  return obj;
}

export function useMailData({ autoFetch = false }: { autoFetch?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const mail = useAppSelector((state) => state.mailAgent);
  const hasFetchedRef = useRef(false);

  const fetchMailbox = useCallback(async () => {
    dispatch(setIsLoading(true));
    try {
      const mailbox = await getTrpcClient().mail.getOrCreateMailbox.query();
      if (mailbox) {
        const data = serializeDates(mailbox) as any;
        dispatch(
          setAgentEmailInfo({
            email: data.email ?? "",
            prompt: data.prompt ?? "",
            emailType: data.emailType ?? 0,
            canEditAgentEmail: data.canEditAgentEmail ?? true,
            createdAt: data.createdAt ?? new Date().toISOString(),
            canEditTime: data.canEditTime ?? new Date().toISOString(),
          })
        );
        if (data.whitelist && Array.isArray(data.whitelist)) {
          dispatch(setEmailWhiteList(serializeDates(data.whitelist) as any));
        }
        if (data.subEmails && Array.isArray(data.subEmails)) {
          dispatch(setAgentSubEmails(serializeDates(data.subEmails) as any));
        }
      }
      hasFetchedRef.current = true;
    } catch (err: any) {
      dispatch(setError(err?.message || "Failed to load mailbox"));
    }
  }, [dispatch]);

  const addWhitelistEmail = useCallback(
    async (email: string) => {
      const entry: AgentEmailWhiteListInfo = {
        email,
        createdAt: new Date().toISOString(),
      };
      dispatch(addToWhitelist(entry));
      try {
        await getTrpcClient().mail.addToWhitelist.mutate({ email });
      } catch {
        dispatch(removeFromWhitelist(email));
      }
    },
    [dispatch]
  );

  const removeWhitelistEmail = useCallback(
    async (email: string) => {
      dispatch(removeFromWhitelist(email));
      try {
        await getTrpcClient().mail.removeFromWhitelist.mutate({ email });
      } catch {
        await fetchMailbox();
      }
    },
    [dispatch, fetchMailbox]
  );

  const updateMailSettings = useCallback(
    async (params: { email?: string; prompt?: string }) => {
      dispatch(setIsSaving(true));
      try {
        await getTrpcClient().mail.updateMailbox.mutate(params as any);
        dispatch(saveEmailEdits());
      } catch (err: any) {
        dispatch(setError(err?.message || "Failed to save mail settings"));
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (!autoFetch || hasFetchedRef.current) return;
    if (mail.agentEmailInfo !== null) return;
    hasFetchedRef.current = true;
    fetchMailbox();
  }, [autoFetch, mail.agentEmailInfo, fetchMailbox]);

  return {
    ...mail,
    fetchMailbox,
    addWhitelistEmail,
    removeWhitelistEmail,
    updateMailSettings,
  };
}
