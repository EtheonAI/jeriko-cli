"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { keys } from "./keys";

// Defer analytics loading until after hydration (non-critical for UX).
// Saves ~500KB from initial bundle per Vercel best practices.
const VercelAnalytics = dynamic(
  () => import("@vercel/analytics/react").then((m) => m.Analytics),
  { ssr: false }
);

const GoogleAnalytics = dynamic(
  () => import("@next/third-parties/google").then((m) => m.GoogleAnalytics),
  { ssr: false }
);

type AnalyticsProviderProps = {
  readonly children: ReactNode;
};

const { NEXT_PUBLIC_GA_MEASUREMENT_ID } = keys();

export const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => (
  <>
    {children}
    <VercelAnalytics />
    {NEXT_PUBLIC_GA_MEASUREMENT_ID && (
      <GoogleAnalytics gaId={NEXT_PUBLIC_GA_MEASUREMENT_ID} />
    )}
  </>
);
