import { analytics } from "@repo/analytics/server";
import { auth } from "@repo/auth";
import { flag } from "flags/next";

export const createFlag = (key: string) =>
  flag({
    key,
    defaultValue: false,
    async decide() {
      const { user } = await auth();

      if (!user.id) {
        return this.defaultValue as boolean;
      }

      const isEnabled = await analytics.isFeatureEnabled(key, user.id);
      return isEnabled ?? (this.defaultValue as boolean);
    },
  });
