import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { ContactForm } from "./components/contact-form";

type ContactProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: ContactProps): Promise<Metadata> => {
  const { locale } = await params;

  return createMetadata({ title: "Contact" });
};

const Contact = async ({ params }: ContactProps) => {
  const { locale } = await params;

  return <ContactForm />;
};

export default Contact;
