import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import { ContactForm } from "./components/contact-form";

export const generateMetadata = async (): Promise<Metadata> =>
  createMetadata({
    title: "Contact",
    description: "Contact the Jeriko team to discuss workflow automation.",
  });

const Contact = () => <ContactForm />;

export default Contact;
