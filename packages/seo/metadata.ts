import type { Metadata } from "next";

export type MetadataGenerator = Omit<
  Metadata,
  | "applicationName"
  | "authors"
  | "creator"
  | "description"
  | "openGraph"
  | "publisher"
  | "title"
  | "twitter"
> & {
  title: string;
  description: string;
  image?: string;
  openGraph?: Metadata["openGraph"];
  twitter?: Metadata["twitter"];
};

const applicationName = "Jeriko";
const author: Metadata["authors"] = {
  name: "Jeriko",
};
const publisher = "Jeriko";

export const createMetadata = ({
  title,
  description,
  image,
  openGraph,
  twitter,
  ...properties
}: MetadataGenerator): Metadata => {
  const parsedTitle = `${title} | ${applicationName}`;
  const formatDetection =
    typeof properties.formatDetection === "object" && properties.formatDetection !== null
      ? properties.formatDetection
      : {};
  const appleWebApp =
    typeof properties.appleWebApp === "object" && properties.appleWebApp !== null
      ? properties.appleWebApp
      : {};
  const imageMetadata = image
    ? [
        {
          alt: title,
          height: 630,
          url: image,
          width: 1200,
        },
      ]
    : undefined;

  return {
    ...properties,
    title: parsedTitle,
    description,
    applicationName,
    authors: [author],
    creator: author.name,
    formatDetection: {
      telephone: false,
      ...formatDetection,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: parsedTitle,
      ...appleWebApp,
    },
    openGraph: {
      type: "website",
      siteName: applicationName,
      locale: "en_US",
      ...openGraph,
      title: parsedTitle,
      description,
      ...(imageMetadata ? { images: imageMetadata } : {}),
    },
    publisher,
    twitter: {
      card: "summary_large_image",
      ...twitter,
      title: parsedTitle,
      description,
      ...(imageMetadata ? { images: imageMetadata } : {}),
    },
  };
};
