"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setAvailableConnectors,
  setInstalledConnectors,
  addInstalledConnector,
  removeInstalledConnector,
  setLoadingAvailable,
  setLoadingInstalled,
  setInstalling,
  setConnectorsError,
  setConnectorSyncStatus,
  type InstalledConnector,
} from "../slices/connectors.slice";
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

function mapDefinition(d: any) {
  return {
    id: d.id,
    uid: d.type ?? d.id,
    type: d.authType === "oauth2" ? "oauth" : d.authType === "api_key" ? "api_key" : "builtin",
    name: d.name,
    brief: d.description ?? "",
    description: d.description,
    iconUrl: d.icon ?? "",
    category: d.category ?? "other",
    order: d.sortOrder ?? 0,
    connectorInfo: [],
    isInstalled: false,
    isEnabled: false,
    isPublished: true,
    scopes: [],
    createdAt: d.createdAt ?? new Date().toISOString(),
    updatedAt: d.updatedAt ?? new Date().toISOString(),
  };
}

function mapInstalled(c: any): InstalledConnector {
  return {
    id: c.definitionId ?? c.id,
    uid: c.type ?? c.definitionId ?? c.id,
    connectionId: c.id,
    userId: c.userId ?? "",
    type: c.authType === "oauth2" ? "oauth" : c.authType === "api_key" ? "api_key" : "builtin",
    name: c.name ?? c.type ?? "",
    brief: c.description ?? "",
    description: c.description,
    iconUrl: c.icon ?? "",
    category: c.category ?? "other",
    order: 0,
    connectorInfo: [],
    isInstalled: true,
    isEnabled: c.isActive ?? true,
    isPublished: true,
    scopes: [],
    credentials: c.credentials,
    lastSyncedAt: c.lastSyncedAt,
    syncStatus: c.syncStatus ?? "idle",
    createdAt: c.createdAt ?? new Date().toISOString(),
    updatedAt: c.updatedAt ?? new Date().toISOString(),
  } as InstalledConnector;
}

export function useConnectorsData({ autoFetch = false }: { autoFetch?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const connectors = useAppSelector((state) => state.connectors);
  const hasFetchedRef = useRef(false);

  const fetchDefinitions = useCallback(async () => {
    dispatch(setLoadingAvailable(true));
    try {
      const definitions = await getTrpcClient().connectors.listDefinitions.query();
      if (definitions && Array.isArray(definitions)) {
        dispatch(setAvailableConnectors(serializeDates(definitions.map(mapDefinition)) as any));
      }
    } catch (err: any) {
      dispatch(setConnectorsError(err?.message || "Failed to load connector definitions"));
    }
  }, [dispatch]);

  const fetchInstalled = useCallback(async () => {
    dispatch(setLoadingInstalled(true));
    try {
      const installed = await getTrpcClient().connectors.list.query();
      if (installed && Array.isArray(installed)) {
        dispatch(setInstalledConnectors(serializeDates(installed.map(mapInstalled)) as any));
      }
    } catch (err: any) {
      dispatch(setConnectorsError(err?.message || "Failed to load installed connectors"));
    }
  }, [dispatch]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchDefinitions(), fetchInstalled()]);
  }, [fetchDefinitions, fetchInstalled]);

  // Mutations
  const install = useCallback(
    async (params: { definitionId: string; config?: Record<string, unknown> }) => {
      dispatch(setInstalling(true));
      try {
        const result = await getTrpcClient().connectors.install.mutate(params as any);
        if (result) {
          dispatch(addInstalledConnector(serializeDates(mapInstalled(result)) as any));
        }
        return result;
      } catch (err: any) {
        dispatch(setInstalling(false));
        dispatch(setConnectorsError(err?.message || "Failed to install connector"));
        throw err;
      }
    },
    [dispatch]
  );

  const uninstall = useCallback(
    async (connectionId: string) => {
      dispatch(removeInstalledConnector(connectionId));
      try {
        await getTrpcClient().connectors.uninstall.mutate({ id: connectionId });
      } catch {
        await fetchInstalled();
      }
    },
    [dispatch, fetchInstalled]
  );

  const disconnect = useCallback(
    async (connectionId: string) => {
      dispatch(removeInstalledConnector(connectionId));
      try {
        await getTrpcClient().connectors.disconnect.mutate({ id: connectionId });
      } catch {
        await fetchInstalled();
      }
    },
    [dispatch, fetchInstalled]
  );

  const sync = useCallback(
    async (connectionId: string) => {
      dispatch(setConnectorSyncStatus({ connectionId, status: "syncing" }));
      try {
        await getTrpcClient().connectors.sync.mutate({ id: connectionId });
        dispatch(setConnectorSyncStatus({ connectionId, status: "idle" }));
      } catch (err: any) {
        dispatch(setConnectorSyncStatus({ connectionId, status: "error", errorMessage: err?.message }));
      }
    },
    [dispatch]
  );

  const checkConnection = useCallback(async (connectionId: string) => {
    return getTrpcClient().connectors.checkConnection.mutate({ id: connectionId });
  }, []);

  const initializeOAuth = useCallback(async (params: { definitionId: string; redirectUrl?: string }) => {
    return getTrpcClient().connectors.initializeOAuth.mutate(params as any);
  }, []);

  const connectWithApiKey = useCallback(
    async (params: { definitionId: string; apiKey: string; config?: Record<string, unknown> }) => {
      dispatch(setInstalling(true));
      try {
        const result = await getTrpcClient().connectors.connectWithApiKey.mutate(params as any);
        if (result) {
          dispatch(addInstalledConnector(serializeDates(mapInstalled(result)) as any));
        }
        return result;
      } catch (err: any) {
        dispatch(setInstalling(false));
        throw err;
      }
    },
    [dispatch]
  );

  const updateConfig = useCallback(
    async (params: { id: string; config: Record<string, unknown> }) => {
      try {
        await getTrpcClient().connectors.updateConfig.mutate(params as any);
        await fetchInstalled();
      } catch (err: any) {
        dispatch(setConnectorsError(err?.message || "Failed to update connector config"));
        throw err;
      }
    },
    [dispatch, fetchInstalled]
  );

  const getConnector = useCallback(async (id: string) => {
    return getTrpcClient().connectors.get.query({ id });
  }, []);

  const getSyncHistory = useCallback(async (id: string) => {
    return getTrpcClient().connectors.getSyncHistory.query({ id });
  }, []);

  useEffect(() => {
    if (!autoFetch || hasFetchedRef.current) return;
    if (connectors.availableConnectors.length > 0) return;
    hasFetchedRef.current = true;
    fetchAll();
  }, [autoFetch, connectors.availableConnectors.length, fetchAll]);

  return {
    // State
    ...connectors,
    // Fetch
    fetchAll,
    fetchDefinitions,
    fetchInstalled,
    // Mutations
    install,
    uninstall,
    disconnect,
    sync,
    checkConnection,
    initializeOAuth,
    connectWithApiKey,
    updateConfig,
    getConnector,
    getSyncHistory,
  };
}
