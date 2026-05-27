"use client";

import { NotificationsProvider as RawNotificationsProvider } from "@repo/notifications/provider";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";

type NotificationsProviderProperties = {
  children: ReactNode;
  userId: string;
};

export const NotificationsProvider = ({ children, userId }: NotificationsProviderProperties) => {
  const { resolvedTheme } = useTheme();

  return (
    <RawNotificationsProvider theme={resolvedTheme as "light" | "dark"} userId={userId}>
      {children}
    </RawNotificationsProvider>
  );
};
