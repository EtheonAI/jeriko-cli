"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setCreditPackages,
  setPersonalPlanTiers,
  setSubscription,
  setCreditBreakdown,
  setPaymentMethods,
  setInvoices,
  setUsageRecords,
  setSubscriptionLoading,
  setLoadingInvoices,
  setLoadingUsage,
  setBillingError,
  removePaymentMethod as removePaymentMethodAction,
  setDefaultPaymentMethod as setDefaultPaymentMethodAction,
  type Subscription,
  type CreditBreakdown,
} from "../slices/billing.slice";
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

export function useBillingData({ autoFetch = false }: { autoFetch?: boolean } = {}) {
  const dispatch = useAppDispatch();
  const billing = useAppSelector((state) => state.billing);
  const hasFetchedRef = useRef(false);

  const fetchPlans = useCallback(async () => {
    try {
      const plans = await getTrpcClient().billing.listPlans.query();
      if (plans && Array.isArray(plans)) {
        dispatch(setPersonalPlanTiers(serializeDates(plans) as any));
      }
    } catch (err: any) {
      dispatch(setBillingError(err?.message || "Failed to load plans"));
    }
  }, [dispatch]);

  const fetchSubscription = useCallback(async () => {
    dispatch(setSubscriptionLoading(true));
    try {
      const sub = await getTrpcClient().billing.getSubscription.query();
      if (sub) {
        const data = serializeDates(sub) as Record<string, any>;
        const s = data.subscription ?? {};
        const p = data.plan ?? {};
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
    } catch (err: any) {
      dispatch(setBillingError(err?.message || "Failed to load subscription"));
    } finally {
      dispatch(setSubscriptionLoading(false));
    }
  }, [dispatch]);

  const fetchCreditBalance = useCallback(async () => {
    try {
      const cb = (await getTrpcClient().billing.getCreditBalance.query()) as Record<string, any>;
      if (cb) {
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
            daily: { available: dailyTotal - dailyUsed, used: dailyUsed, total: dailyTotal, refreshAmount: cb.dailyRefreshAmount ?? 300 },
            monthly: { available: monthlyTotal - monthlyUsed, used: monthlyUsed, total: monthlyTotal },
            purchased: { available: purchasedTotal - purchasedUsed, used: purchasedUsed, total: purchasedTotal },
            starter: { available: starterTotal - starterUsed, used: starterUsed, total: starterTotal },
            autoTopupEnabled: cb.autoTopupEnabled ?? false,
          } as CreditBreakdown)
        );
      }
    } catch (err: any) {
      dispatch(setBillingError(err?.message || "Failed to load credit balance"));
    }
  }, [dispatch]);

  const fetchCreditPackages = useCallback(async () => {
    try {
      const packages = await getTrpcClient().billing.listCreditPackages.query();
      if (packages && Array.isArray(packages)) {
        dispatch(setCreditPackages(serializeDates(packages) as any));
      }
    } catch (err: any) {
      dispatch(setBillingError(err?.message || "Failed to load credit packages"));
    }
  }, [dispatch]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const methods = await getTrpcClient().billing.listPaymentMethods.query();
      if (methods && Array.isArray(methods)) {
        dispatch(setPaymentMethods(serializeDates(methods) as any));
      }
    } catch {
      // Payment methods are optional — don't set error
    }
  }, [dispatch]);

  const fetchInvoices = useCallback(async () => {
    dispatch(setLoadingInvoices(true));
    try {
      const invoices = await getTrpcClient().billing.listInvoices.query();
      if (invoices && Array.isArray(invoices)) {
        dispatch(setInvoices(serializeDates(invoices) as any));
      }
    } catch (err: any) {
      dispatch(setBillingError(err?.message || "Failed to load invoices"));
    }
  }, [dispatch]);

  const fetchUsageRecords = useCallback(
    async (params?: { startDate?: string; endDate?: string; type?: string }) => {
      dispatch(setLoadingUsage(true));
      try {
        const records = await getTrpcClient().billing.getUsageRecords.query(params ?? {});
        if (records && Array.isArray(records)) {
          dispatch(setUsageRecords(serializeDates(records) as any));
        }
      } catch (err: any) {
        dispatch(setBillingError(err?.message || "Failed to load usage records"));
      }
    },
    [dispatch]
  );

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchCreditBalance(),
      fetchSubscription(),
      fetchPlans(),
      fetchCreditPackages(),
    ]);
  }, [fetchCreditBalance, fetchSubscription, fetchPlans, fetchCreditPackages]);

  // Mutations
  const createCheckout = useCallback(
    async (params: { planId: string; interval: string }) => {
      return getTrpcClient().billing.createCheckout.mutate(params as any);
    },
    []
  );

  const cancelSubscription = useCallback(async () => {
    const result = await getTrpcClient().billing.cancelSubscription.mutate();
    await fetchSubscription();
    return result;
  }, [fetchSubscription]);

  const reactivateSubscription = useCallback(async () => {
    const result = await getTrpcClient().billing.reactivateSubscription.mutate();
    await fetchSubscription();
    return result;
  }, [fetchSubscription]);

  const deletePaymentMethod = useCallback(
    async (id: string) => {
      dispatch(removePaymentMethodAction(id));
      try {
        await getTrpcClient().billing.deletePaymentMethod.mutate({ id });
      } catch {
        await fetchPaymentMethods();
      }
    },
    [dispatch, fetchPaymentMethods]
  );

  const setDefaultPayment = useCallback(
    async (id: string) => {
      dispatch(setDefaultPaymentMethodAction(id));
      try {
        await getTrpcClient().billing.setDefaultPaymentMethod.mutate({ id });
      } catch {
        await fetchPaymentMethods();
      }
    },
    [dispatch, fetchPaymentMethods]
  );

  const getBillingPortalUrl = useCallback(async () => {
    return getTrpcClient().billing.getBillingPortalUrl.mutate();
  }, []);

  const purchaseCredits = useCallback(async (params: { packageId: string }) => {
    return getTrpcClient().billing.purchaseCredits.mutate(params);
  }, []);

  useEffect(() => {
    if (!autoFetch || hasFetchedRef.current) return;
    if (billing.subscription !== null) return;
    hasFetchedRef.current = true;
    fetchAll();
  }, [autoFetch, billing.subscription, fetchAll]);

  return {
    // State
    ...billing,
    // Fetch actions
    fetchAll,
    fetchPlans,
    fetchSubscription,
    fetchCreditBalance,
    fetchCreditPackages,
    fetchPaymentMethods,
    fetchInvoices,
    fetchUsageRecords,
    // Mutations
    createCheckout,
    cancelSubscription,
    reactivateSubscription,
    deletePaymentMethod,
    setDefaultPaymentMethod: setDefaultPayment,
    getBillingPortalUrl,
    purchaseCredits,
  };
}
