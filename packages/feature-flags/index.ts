import { createFlag } from "./lib/create-flag";

export const showBetaFeature = createFlag("showBetaFeature", {
  description: "Show reset-shell beta UI to eligible authenticated users.",
  origin: "https://vercel.com/docs/flags",
});
