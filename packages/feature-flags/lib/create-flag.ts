import { analytics } from "@repo/analytics/server";
import { auth } from "@repo/auth";
import { flag } from "flags/next";
import { headers } from "next/headers";

export const createFlag = (key: string) =>
  flag({
    key,
    defaultValue: false,
    async decide() {
      const headersList = await headers();
      const session = await auth.api.getSession({ headers: headersList });

      if (!session?.user?.id) {
        return this.defaultValue as boolean;
      }

      const isEnabled = await analytics.isFeatureEnabled(key, session.user.id);
      return isEnabled ?? (this.defaultValue as boolean);
    },
  });
