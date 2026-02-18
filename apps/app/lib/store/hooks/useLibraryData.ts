"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setFiles,
  setFilesLoading,
  setFilesError,
  setVersions,
  toggleAttachmentFavorite,
  removeFile,
  type FileItem,
} from "../slices/library.slice";
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

export function useLibraryData({ autoFetch = false }: { autoFetch?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const library = useAppSelector((state) => state.library);
  const hasFetchedRef = useRef(false);

  const fetchFiles = useCallback(
    async (sessionId?: string) => {
      dispatch(setFilesLoading(true));
      try {
        const data = sessionId
          ? await getTrpcClient().files.listBySession.query({ sessionId })
          : await getTrpcClient().files.list.query({});
        const files = (Array.isArray(data) ? data : (data as any)?.items ?? []).map(
          (f: any) => serializeDates(f) as FileItem
        );
        dispatch(setFiles(files));
        hasFetchedRef.current = true;
      } catch (err: any) {
        dispatch(setFilesError(err?.message || "Failed to load files"));
      }
    },
    [dispatch]
  );

  const fetchVersions = useCallback(
    async (fileId: string) => {
      try {
        const versions = await getTrpcClient().files.versions.query({ fileId });
        if (versions && Array.isArray(versions)) {
          dispatch(setVersions({ fileId, versions: serializeDates(versions) as any }));
        }
      } catch {
        // Version history is supplementary — don't set global error
      }
    },
    [dispatch]
  );

  const getContent = useCallback(async (fileId: string) => {
    return getTrpcClient().files.getContent.query({ id: fileId });
  }, []);

  const getDownloadUrl = useCallback(async (fileId: string) => {
    return getTrpcClient().files.getDownloadUrl.query({ fileId });
  }, []);

  const getStorageUsage = useCallback(async () => {
    return getTrpcClient().files.getStorageUsage.query();
  }, []);

  // Share mutations
  const createShare = useCallback(async (fileId: string) => {
    return getTrpcClient().files.createShare.mutate({ fileId });
  }, []);

  const getShare = useCallback(async (fileId: string) => {
    return getTrpcClient().files.getShare.query({ fileId });
  }, []);

  const revokeShare = useCallback(async (fileId: string) => {
    return getTrpcClient().files.revokeShare.mutate({ fileId });
  }, []);

  const toggleFavorite = useCallback(
    async (fileId: string) => {
      dispatch(toggleAttachmentFavorite(fileId));
      try {
        await getTrpcClient().files.toggleFavorite.mutate({ fileId });
      } catch {
        // Revert by re-toggling
        dispatch(toggleAttachmentFavorite(fileId));
      }
    },
    [dispatch]
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      dispatch(removeFile(fileId));
      try {
        await getTrpcClient().files.delete.mutate({ id: fileId });
      } catch {
        await fetchFiles();
      }
    },
    [dispatch, fetchFiles]
  );

  useEffect(() => {
    if (!autoFetch || hasFetchedRef.current) return;
    if (library.files.length > 0) return;
    hasFetchedRef.current = true;
    fetchFiles();
  }, [autoFetch, library.files.length, fetchFiles]);

  return {
    // State
    ...library,
    // Fetch
    fetchFiles,
    fetchVersions,
    getContent,
    getDownloadUrl,
    getStorageUsage,
    // Share
    createShare,
    getShare,
    revokeShare,
    // Mutations
    toggleFavorite,
    deleteFile,
  };
}
