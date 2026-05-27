import { hasLocale } from "@repo/internationalization";
import { routing } from "@repo/internationalization/routing";
import { getRequestConfig } from "@repo/internationalization/server";

export default getRequestConfig(async function createRequestConfig({ requestLocale }) {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`@repo/internationalization/dictionaries/${locale}.json`)).default,
  };
});
