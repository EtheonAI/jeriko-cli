import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es", "de", "zh", "fr", "pt"],

  defaultLocale: "en",
});
