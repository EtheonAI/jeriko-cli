"use client";

import { useEffect, useRef, startTransition } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  setNotifications,
  setNotificationsError,
  setLoading as setNotificationsLoading,
  setUnreadCounts,
  type Notification,
} from "@/lib/store/slices/notifications.slice";
import {
  setSessions,
  setSessionsLoading,
} from "@/lib/store/slices/sessions.slice";
import {
  setCreditBreakdown,
  setSubscription,
  setPersonalPlanTiers,
  setCreditPackages,
  setSubscriptionLoading,
  type Subscription,
} from "@/lib/store/slices/billing.slice";
import { setUser, type User } from "@/lib/store/slices/auth.slice";
import {
  initializeConfigs,
  setLoading as setConfigsLoading,
} from "@/lib/store/slices/configs.slice";
import {
  setProjects,
  setLoading as setProjectsLoading,
} from "@/lib/store/slices/projects.slice";
import {
  setAvailableConnectors,
  setInstalledConnectors,
  setLoadingAvailable,
  setLoadingInstalled,
} from "@/lib/store/slices/connectors.slice";
import {
  setIsMobile,
  setWindowWidth,
} from "@/lib/store/slices/ui.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import type { ServerUser } from "./providers";

/**
 * Serialize any Date objects in an object tree to ISO strings.
 * Redux requires all state to be serializable — tRPC/Drizzle
 * returns Date objects for createdAt/updatedAt fields.
 */
function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * ReduxDataLoader — Hydrates Redux slices on initial authenticated page load.
 *
 * PERFORMANCE STRATEGY:
 * - Uses getTrpcClient().X.query() — vanilla tRPC calls (no React Query).
 * - P0 (immediate): auth + sessions + configs — needed for sidebar + app shell
 * - P1 (deferred 100ms): billing + notifications — header badges
 * - P2 (deferred 300ms): projects + connectors — dropdown menus
 *
 * Guards use Redux state so data is only fetched ONCE per session, not on
 * every navigation.
 */
interface ReduxDataLoaderProps {
  serverUser?: ServerUser;
}

export function ReduxDataLoader({ serverUser }: ReduxDataLoaderProps) {
  const dispatch = useAppDispatch();

  // Read existing Redux state to skip fetches if already populated.
  const hasSessions = useAppSelector((s) => s.sessions.sessions.length > 0);
  const hasSubscription = useAppSelector((s) => s.billing.subscription !== null);
  const hasNotifications = useAppSelector((s) => s.notifications.notifications.length > 0);
  const hasConfigs = useAppSelector((s) => s.configs.isInitialized);
  const hasProjects = useAppSelector((s) => s.projects.projects.length > 0);
  const hasConnectors = useAppSelector((s) => s.connectors.availableConnectors.length > 0);
  const hasAuth = useAppSelector((s) => s.auth.user !== null);

  // Ref guards for in-flight requests (prevents double-fire within same render)
  const fetchingRef = useRef<Record<string, boolean>>({});

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

  // ─── P0: IMMEDIATE — Sessions (sidebar needs these right away) ───
  useEffect(() => {
    if (hasSessions || fetchingRef.current.sessions) return;
    fetchingRef.current.sessions = true;

    dispatch(setSessionsLoading(true));
    getTrpcClient().sessions.list
      .query()
      .then((sessions: any[]) => {
        const serialized = serializeDates(sessions);
        dispatch(
          setSessions({
            sessions: serialized,
            hasMore: false,
            cursor: null,
            totalCount: serialized.length,
          })
        );
      })
      .catch(() => {
        fetchingRef.current.sessions = false;
      });
  }, [dispatch, hasSessions]);

  // ─── P0: IMMEDIATE — Configs (app settings, needed for theme/fontSize) ───
  useEffect(() => {
    if (hasConfigs || fetchingRef.current.configs) return;
    fetchingRef.current.configs = true;

    dispatch(setConfigsLoading(true));
    getTrpcClient().user.getPreferences
      .query()
      .then((prefs: any) => {
        dispatch(
          initializeConfigs({
            clientConfig: {
              language: prefs.communicationStyle ? undefined : undefined,
              agent: {
                defaultModel: prefs.defaultModel ?? "claude-3-opus",
                temperature: 0.7,
                maxTokens: 4096,
                tools: [],
                capabilities: [],
              },
              chat: {
                streamingEnabled: true,
                autoScroll: true,
                showTimestamps: true,
                showToolCalls: true,
                showTokenUsage: false,
                codeHighlighting: true,
                markdownRendering: true,
              },
              notifications: {
                soundEnabled: true,
                desktopEnabled: true,
                emailEnabled: true,
                taskComplete: true,
                taskFailed: true,
                mentions: true,
              },
              privacy: {
                analyticsEnabled: prefs.analyticsEnabled ?? true,
                crashReportingEnabled: prefs.crashReports ?? true,
                personalizationEnabled: prefs.personalizedExperience ?? true,
                shareUsageData: false,
              },
              accessibility: {
                reducedMotion: false,
                highContrast: false,
                fontSize: prefs.fontSize ?? "medium",
                keyboardShortcutsEnabled: true,
              },
            },
          })
        );
      })
      .catch(() => {
        fetchingRef.current.configs = false;
        dispatch(setConfigsLoading(false));
      });
  }, [dispatch, hasConfigs]);

  // ─── P1: DEFERRED — Billing + Notifications (header badges, not blocking) ───
  useEffect(() => {
    if ((hasSubscription && hasNotifications) || fetchingRef.current.p1Deferred) return;
    fetchingRef.current.p1Deferred = true;

    const timer = setTimeout(() => {
      // Billing — uses React Query cache (server prefetch for getCreditBalance)
      if (!hasSubscription && !fetchingRef.current.billing) {
        fetchingRef.current.billing = true;
        dispatch(setSubscriptionLoading(true));
        const client = getTrpcClient();
        Promise.all([
          client.billing.getCreditBalance.query().catch(() => null),
          client.billing.getSubscription.query().catch(() => null),
          client.billing.listPlans.query().catch(() => null),
          client.billing.listCreditPackages.query().catch(() => null),
        ])
          .then(([creditBalance, subscription, plans, creditPackages]) => {
            // startTransition: billing data is P1 (non-urgent).
            // Marks these dispatches as interruptible so they don't block
            // user input or P0 sidebar rendering.
            startTransition(() => {
              if (creditBalance) {
                const cb = creditBalance as Record<string, any>;
                const dailyTotal = cb.dailyCredits ?? 0;
                const dailyUsed = cb.dailyCreditsUsed ?? 0;
                const monthlyTotal = cb.periodCredits ?? 0;
                const monthlyUsed = cb.periodCreditsUsed ?? 0;
                const purchasedTotal = cb.purchasedCredits ?? 0;
                const purchasedUsed = cb.purchasedCreditsUsed ?? 0;
                const starterTotal = cb.starterCredits ?? 0;
                const starterUsed = cb.starterCreditsUsed ?? 0;

                dispatch(
                  setCreditBreakdown({
                    total: cb.balance ?? 0,
                    daily: {
                      available: dailyTotal - dailyUsed,
                      used: dailyUsed,
                      total: dailyTotal,
                      refreshAmount: cb.dailyRefreshAmount ?? 300,
                    },
                    monthly: {
                      available: monthlyTotal - monthlyUsed,
                      used: monthlyUsed,
                      total: monthlyTotal,
                    },
                    purchased: {
                      available: purchasedTotal - purchasedUsed,
                      used: purchasedUsed,
                      total: purchasedTotal,
                    },
                    starter: {
                      available: starterTotal - starterUsed,
                      used: starterUsed,
                      total: starterTotal,
                    },
                    autoTopupEnabled: cb.autoTopupEnabled ?? false,
                  })
                );
              }
              if (subscription) {
                const sub = serializeDates(subscription) as Record<string, any>;
                const s = sub.subscription ?? {};
                const p = sub.plan ?? {};
                dispatch(
                  setSubscription({
                    id: s.id ?? "",
                    plan: p.type ?? "free",
                    status: s.status ?? "active",
                    interval: s.interval ?? "monthly",
                    currentPeriodStart: s.currentPeriodStart ?? "",
                    currentPeriodEnd: s.currentPeriodEnd ?? "",
                    cancelAtPeriodEnd: s.cancelAtPeriodEnd ?? false,
                    credits: p.monthlyCredits ?? 0,
                    creditsUsed: 0,
                  } as Subscription)
                );
              }
              if (plans && Array.isArray(plans)) {
                dispatch(setPersonalPlanTiers(serializeDates(plans) as any));
              }
              if (creditPackages && Array.isArray(creditPackages)) {
                dispatch(setCreditPackages(serializeDates(creditPackages) as any));
              }
            });
          })
          .catch(() => {
            fetchingRef.current.billing = false;
          })
          .finally(() => {
            dispatch(setSubscriptionLoading(false));
          });
      }

      // Notifications
      if (!hasNotifications && !fetchingRef.current.notifications) {
        fetchingRef.current.notifications = true;
        dispatch(setNotificationsLoading(true));
        const notifClient = getTrpcClient();
        Promise.all([
          notifClient.notifications.list.query({ limit: 50, offset: 0, unreadOnly: false }),
          notifClient.notifications.getUnreadCountsByType.query(),
        ])
          .then(([list, unreadByType]) => {
            startTransition(() => {
              const normalized: Notification[] = (list.items ?? []).map((n: any) => ({
                ...n,
                isArchived: n.isArchived ?? false,
                isRead: n.isRead ?? false,
                priority: n.priority ?? "normal",
                createdAt:
                  typeof n.createdAt === "string" ? n.createdAt : new Date(n.createdAt).toISOString(),
              }));
              dispatch(
                setNotifications({
                  notifications: normalized,
                  hasMore: list.hasMore ?? false,
                  cursor: null,
                })
              );
              if (unreadByType) {
                const total = Object.values(unreadByType).reduce(
                  (sum, value) => sum + (value as number),
                  0
                );
                dispatch(setUnreadCounts({ total, byType: unreadByType as any }));
              }
            });
          })
          .catch((error: any) => {
            fetchingRef.current.notifications = false;
            dispatch(setNotificationsError(error?.message || "Failed to load notifications"));
          })
          .finally(() => {
            dispatch(setNotificationsLoading(false));
          });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [dispatch, hasSubscription, hasNotifications]);

  // ─── P2: DEFERRED — Projects + Connectors (dropdowns, rarely immediate) ───
  useEffect(() => {
    if ((hasProjects && hasConnectors) || fetchingRef.current.p2Deferred) return;
    fetchingRef.current.p2Deferred = true;

    const timer = setTimeout(() => {
      // Projects
      if (!hasProjects && !fetchingRef.current.projects) {
        fetchingRef.current.projects = true;
        dispatch(setProjectsLoading(true));
        getTrpcClient().projects.list
          .query({ status: "active", limit: 100, offset: 0, includeShared: true })
          .then((result: any) => {
            startTransition(() => {
              const items = Array.isArray(result) ? result : (result.items ?? []);
              dispatch(setProjects(serializeDates(items) as any));
            });
          })
          .catch(() => {
            fetchingRef.current.projects = false;
            dispatch(setProjectsLoading(false));
          });
      }

      // Connectors
      if (!hasConnectors && !fetchingRef.current.connectors) {
        fetchingRef.current.connectors = true;
        dispatch(setLoadingAvailable(true));
        dispatch(setLoadingInstalled(true));
        const connClient = getTrpcClient();
        Promise.all([
          connClient.connectors.listDefinitions.query().catch(() => null),
          connClient.connectors.list.query().catch(() => null),
        ])
          .then(([definitions, installed]) => {
            startTransition(() => {
              if (definitions && Array.isArray(definitions)) {
                const mapped = definitions.map((d: any) => ({
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
                }));
                dispatch(setAvailableConnectors(serializeDates(mapped) as any));
              } else {
                dispatch(setLoadingAvailable(false));
              }
              if (installed && Array.isArray(installed)) {
                const mapped = installed.map((c: any) => ({
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
                }));
                dispatch(setInstalledConnectors(serializeDates(mapped) as any));
              } else {
                dispatch(setLoadingInstalled(false));
              }
            });
          })
          .catch(() => {
            fetchingRef.current.connectors = false;
            dispatch(setLoadingAvailable(false));
            dispatch(setLoadingInstalled(false));
          });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [dispatch, hasProjects, hasConnectors]);

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

  return null;
}
