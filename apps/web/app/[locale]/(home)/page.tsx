import { showBetaFeature } from "@repo/feature-flags";
import { getTranslations } from "@repo/internationalization/server";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { Cases } from "./components/cases";
import { CTA } from "./components/cta";
import { FAQ } from "./components/faq";
import { Features } from "./components/features";
import { Hero } from "./components/hero";
import { Stats } from "./components/stats";
import { Testimonials } from "./components/testimonials";

type HomeProps = {
  params: Promise<{
    locale: string;
  }>;
};

// export const generateMetadata = async ({
//   params,
// }: HomeProps): Promise<Metadata> => {
//   const { locale } = await params;
//   const dictionary = await getDictionary(locale);

//   return createMetadata(dictionary.web.home.meta);
// };

const Home = async () => {
  const t = await getTranslations("web");
  const betaFeature = await showBetaFeature();

  return (
    <>
      {betaFeature && (
        <div className="w-full bg-black py-2 text-center text-white">
          {t('title')}
        </div>
      )}
      <Hero />
      {/* <Cases />
      <Features />
      <Stats /> */}
      {/* <Testimonials />
      <FAQ />
      <CTA /> */}
    </>
  );
};

export default Home;
