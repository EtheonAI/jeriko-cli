import de from "./dictionaries/de.json";
import en from "./dictionaries/en.json";
import es from "./dictionaries/es.json";
import fr from "./dictionaries/fr.json";
import pt from "./dictionaries/pt.json";
import zh from "./dictionaries/zh.json";
import { routing } from "./routing";

export type Locale = (typeof routing.locales)[number];
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  de,
  en,
  es,
  fr,
  pt,
  zh,
};

export async function getDictionary(locale: string): Promise<Dictionary> {
  const normalizedLocale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  return dictionaries[normalizedLocale];
}

export function hasLocale(
  locales: readonly string[],
  locale: string | undefined
): locale is Locale {
  return !!locale && locales.includes(locale);
}

export * from "next-intl";
