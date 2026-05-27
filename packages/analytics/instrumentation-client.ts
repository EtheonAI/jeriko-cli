import { keys } from "./keys";

// Lazy-load posthog-js to keep it out of the initial bundle.
// It's loaded asynchronously after hydration.
export const initializeAnalytics = () => {
  const env = keys();
  const posthogKey = env.NEXT_PUBLIC_POSTHOG_KEY;

  if (!posthogKey) {
    return;
  }

  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
      defaults: "2025-05-24",
    });
  });
};
