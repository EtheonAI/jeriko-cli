import { flag } from "flags/next";
import { headers } from "next/headers";

type BooleanFlagOptions = {
  description?: string;
  origin?: string;
};

export const createFlag = (key: string, options: BooleanFlagOptions = {}) =>
  flag<boolean>({
    key,
    defaultValue: false,
    description: options.description,
    origin: options.origin,
    options: [
      { value: false, label: "Disabled" },
      { value: true, label: "Enabled" },
    ],
    async decide() {
      const headersList = await headers();
      const [{ analytics }, { auth }] = await Promise.all([
        import("@repo/analytics/server"),
        import("@repo/auth"),
      ]);
      const session = await auth.api.getSession({ headers: headersList });

      if (!session?.user?.id) {
        return false;
      }

      if (!analytics) {
        return false;
      }

      const isEnabled = await analytics.isFeatureEnabled(key, session.user.id);
      return isEnabled ?? false;
    },
  });
