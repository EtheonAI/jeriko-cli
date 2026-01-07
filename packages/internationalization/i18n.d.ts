import type messages from "./dictionaries/en.json";
import type { Locale } from "./index";

type Messages = typeof messages;

declare module "next-intl" {
    interface AppConfig {
        Locale: Locale;
        Messages: Messages;
    }
}
