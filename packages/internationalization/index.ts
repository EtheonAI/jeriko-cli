import type { routing } from "./routing";

export type Locale = (typeof routing.locales)[number];

export * from "next-intl";
