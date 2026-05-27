import { getTranslations } from "@repo/internationalization/server";
import { Button } from "@repo/design-system/components/ui/button";
import { MoveRight, PhoneCall } from "lucide-react";
import Link from "next/link";
import { env } from "@/env";
import { getLatestBlogPost } from "@/lib/content";

export const Hero = async () => {
  const t = await getTranslations("web");
  const latestPost = await getLatestBlogPost();

  return (
    <div className="w-full">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-center gap-8 py-20 lg:py-40">
          {latestPost ? (
            <div>
              <Button asChild className="gap-4" size="sm" variant="secondary">
                <Link href={`/blog/${latestPost._slug}`}>
                  {t("title")} <MoveRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : null}
          <div className="flex flex-col gap-4">
            <h1 className="max-w-2xl text-center font-regular text-5xl tracking-tighter md:text-7xl">
              {t("title")}
            </h1>
            <p className="max-w-2xl text-center text-lg text-muted-foreground leading-relaxed tracking-tight md:text-xl">
              {t("title")}
            </p>
          </div>
          <div className="flex flex-row gap-3">
            <Button asChild className="gap-4" size="lg" variant="outline">
              <Link href="/contact">
                {t("title")} <PhoneCall className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="gap-4" size="lg">
              <Link href={env.NEXT_PUBLIC_APP_URL}>
                {t("title")} <MoveRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
