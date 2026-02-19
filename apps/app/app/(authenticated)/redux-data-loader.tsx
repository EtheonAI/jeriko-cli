"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector, useAppStore } from "@/lib/store/hooks";
import { setUser, type User } from "@/lib/store/slices/auth.slice";
import {
  setIsMobile,
  setWindowWidth,
} from "@/lib/store/slices/ui.slice";
import { setSessions } from "@/lib/store/slices/sessions.slice";
import { useGetSessionsQuery } from "@/lib/store/api/api.slice";
import {
  initializeConfigs,
} from "@/lib/store/slices/configs.slice";
import type { RootState } from "@/lib/store";
import type { ServerUser } from "./providers";

/**
 * ReduxDataLoader — Minimal bootstrap for authenticated pages.
 *
 * Manus architecture: RTK Query auto-fetches data when components mount
 * their hooks (useGetSessionsQuery, useGetSubscriptionQuery, etc.).
 * This loader only handles:
 * 1. Server user → auth slice sync (zero network request)
 * 2. Window resize listener → ui slice
 *
 * All data fetching is now handled by RTK Query hooks in the consuming
 * components. WebSocket events trigger invalidateTags() for auto-refetches.
 */
interface ReduxDataLoaderProps {
  serverUser?: ServerUser;
}

export function ReduxDataLoader({ serverUser }: ReduxDataLoaderProps) {
  const dispatch = useAppDispatch();
  const hasAuth = useAppSelector((s) => s.auth.user !== null);

  // Sync server-provided user into Redux auth slice — ZERO network request.
  // The RSC layout already called getSession() on the server and passed user data down.
  useEffect(() => {
    if (hasAuth || !serverUser) return;

    const user: User = {
      id: serverUser.id,
      email: serverUser.email,
      name: serverUser.name,
      image: serverUser.image,
      role: "user",
      emailVerified: serverUser.emailVerified,
      createdAt: serverUser.createdAt,
    };
    dispatch(setUser(user));
  }, [serverUser, dispatch, hasAuth]);

  // Initialize configs slice from localStorage — ZERO network request.
  // Persists user preferences across sessions (Manus parity: local config hydration).
  const configsInitRef = useRef(false);
  useEffect(() => {
    if (configsInitRef.current) return;
    configsInitRef.current = true;
    try {
      const raw = localStorage.getItem("rubic-configs");
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Parameters<typeof initializeConfigs>[0]>;
        dispatch(initializeConfigs(saved));
      } else {
        dispatch(initializeConfigs({}));
      }
    } catch {
      dispatch(initializeConfigs({}));
    }
  }, [dispatch]);

  // Persist configs slice to localStorage on change (Manus parity: local config persistence).
  const store = useAppStore();
  const configsPersistRef = useRef(false);
  useEffect(() => {
    if (configsPersistRef.current) return;
    configsPersistRef.current = true;

    let prevConfigs: string | undefined;
    const unsubscribe = store.subscribe(() => {
      const state = store.getState() as RootState;
      if (!state.configs.isInitialized) return;
      // Only persist user-facing config keys (not loading/error transient state)
      const toSave = {
        clientConfig: state.configs.clientConfig,
        features: state.configs.features,
        // Manus-aligned preference flags
        sessionListPinned: state.configs.sessionListPinned,
        agentWorkspaceAutoExpanded: state.configs.agentWorkspaceAutoExpanded,
        automaticallyLearnKnowledge: state.configs.automaticallyLearnKnowledge,
        theme: state.configs.theme,
        chatSidebarMode: state.configs.chatSidebarMode,
        gotoComputerTipsShowed: state.configs.gotoComputerTipsShowed,
        agentMailCardShowed: state.configs.agentMailCardShowed,
      };
      const json = JSON.stringify(toSave);
      if (json !== prevConfigs) {
        prevConfigs = json;
        try { localStorage.setItem("rubic-configs", json); } catch { /* quota exceeded */ }
      }
    });

    return () => {
      configsPersistRef.current = false;
      unsubscribe();
    };
  }, [store]);

  // Initialize UI slice — window resize listener for responsive layout.
  const uiInitRef = useRef(false);
  useEffect(() => {
    if (uiInitRef.current) return;
    uiInitRef.current = true;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const updateDimensions = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = window.innerWidth;
        dispatch(setWindowWidth(w));
        dispatch(setIsMobile(w < 768));
      }, 150);
    };

    // Initial measurement (immediate, no debounce)
    const w = window.innerWidth;
    dispatch(setWindowWidth(w));
    dispatch(setIsMobile(w < 768));

    window.addEventListener("resize", updateDimensions);
    return () => {
      uiInitRef.current = false;
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", updateDimensions);
    };
  }, [dispatch]);

  // Bridge: RTK Query sessions → Redux sessions slice.
  // Some components (chat-header, chat-item) still read from state.sessions.
  // RTK Query is the source of truth; this syncs to the legacy slice.
  const { data: rtkSessions } = useGetSessionsQuery();
  const sessionsRef = useRef(rtkSessions);
  useEffect(() => {
    if (rtkSessions && rtkSessions !== sessionsRef.current) {
      sessionsRef.current = rtkSessions;
      dispatch(setSessions(rtkSessions as any));
    }
  }, [rtkSessions, dispatch]);

  return null;
}
