import { keys } from "./keys";

// Lazy-load posthog-js to keep it out of the initial bundle.
// It's loaded asynchronously after hydration.
export const initializeAnalytics = () => {
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(keys().NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: keys().NEXT_PUBLIC_POSTHOG_HOST,
      defaults: "2025-05-24",
    });
  });
};
