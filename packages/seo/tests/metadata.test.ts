import { describe, expect, it } from "vitest";
import { createMetadata } from "../metadata";

describe("createMetadata", () => {
  it("creates shared Jeriko metadata defaults", () => {
    const metadata = createMetadata({
      description: "Build and run AI workflows.",
      title: "AI Workflow OS",
    });

    expect(metadata.applicationName).toBe("Jeriko");
    expect(metadata.title).toBe("AI Workflow OS | Jeriko");
    expect(metadata.description).toBe("Build and run AI workflows.");
    expect(metadata.openGraph).toMatchObject({
      description: "Build and run AI workflows.",
      siteName: "Jeriko",
      title: "AI Workflow OS | Jeriko",
      type: "website",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      description: "Build and run AI workflows.",
      title: "AI Workflow OS | Jeriko",
    });
  });

  it("adds Open Graph and Twitter images when provided", () => {
    const metadata = createMetadata({
      description: "A product preview.",
      image: "https://example.com/og.png",
      title: "Preview",
    });

    expect(metadata.openGraph).toMatchObject({
      images: [
        {
          alt: "Preview",
          height: 630,
          url: "https://example.com/og.png",
          width: 1200,
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      images: [
        {
          alt: "Preview",
          height: 630,
          url: "https://example.com/og.png",
          width: 1200,
        },
      ],
    });
  });

  it("preserves route overrides while keeping strict title and description", () => {
    const metadata = createMetadata({
      alternates: {
        canonical: "/contact",
      },
      description: "Talk to the Jeriko team.",
      openGraph: {
        type: "article",
      },
      title: "Contact",
    });

    expect(metadata.alternates).toEqual({
      canonical: "/contact",
    });
    expect(metadata.openGraph).toMatchObject({
      description: "Talk to the Jeriko team.",
      title: "Contact | Jeriko",
      type: "article",
    });
  });
});
