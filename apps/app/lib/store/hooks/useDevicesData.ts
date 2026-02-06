"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import { setDevices, setDevicesError, setDevicesLoading } from "../slices/devices.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";

export function useDevicesData({ autoFetch = true }: { autoFetch?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const { devices, isLoading, error } = useAppSelector((state) => state.devices);
  const hasFetchedRef = useRef(false);

  const fetchDevices = useCallback(async () => {
    dispatch(setDevicesLoading(true));
    try {
      const data = await getTrpcClient().devices.list.query();
      const normalized = (Array.isArray(data) ? data : []).map((d: any) => ({
        ...d,
        capabilities: d.capabilities ?? [],
      }));
      dispatch(setDevices(normalized));
      hasFetchedRef.current = true; // Mark as fetched only after success
    } catch (err: any) {
      dispatch(setDevicesError(err?.message || "Failed to load devices"));
      // Don't set hasFetchedRef — allows retry
    } finally {
      dispatch(setDevicesLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!autoFetch) return;
    if (hasFetchedRef.current) return;
    if (devices.length > 0) return;
    fetchDevices();
  }, [autoFetch, devices.length, fetchDevices]);

  return { devices, isLoading, error, refetch: fetchDevices };
}
