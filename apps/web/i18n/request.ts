import { hasLocale } from "@repo/internationalization";
import { routing } from "@repo/internationalization/routing";
import { getRequestConfig } from "@repo/internationalization/server";

export default getRequestConfig(async function createRequestConfig({
    requestLocale,
}) {
    // Typically corresponds to the `[locale]` segment
    const requested = await requestLocale;
    const locale = hasLocale(routing.locales, requested)
        ? requested
        : routing.defaultLocale;

    console.log("Locale selected in request config:", locale, routing.locales, requested);

    return {
        locale,
        messages: (await import(`@repo/internationalization/dictionaries/${locale}.json`)).default,
    };
});
