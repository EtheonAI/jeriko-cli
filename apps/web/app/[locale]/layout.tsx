import "./styles.css";
import { AnalyticsProvider } from "@repo/analytics/provider";
import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import { cn } from "@repo/design-system/lib/utils";
import { Toolbar } from "@repo/feature-flags/toolbar";
import { hasLocale, NextIntlClientProvider } from "@repo/internationalization";
import { routing } from "@repo/internationalization/routing";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Footer } from "./components/footer";
import { Header } from "./components/header";

type RootLayoutProperties = {
  readonly children: ReactNode;
  readonly params: Promise<{
    locale: string;
  }>;
};

const RootLayout = async ({ children, params }: RootLayoutProperties) => {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html className={cn(fonts, "scroll-smooth")} lang={locale} suppressHydrationWarning>
      <body>
        <AnalyticsProvider>
          <DesignSystemProvider>
            <Header />
            <NextIntlClientProvider>{children}</NextIntlClientProvider>
            <Footer />
          </DesignSystemProvider>
          <Toolbar />
        </AnalyticsProvider>
      </body>
    </html>
  );
};

export default RootLayout;
