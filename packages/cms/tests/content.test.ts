import { describe, expect, it } from "vitest";
import { content, createPayloadContentClient, createStaticContentClient } from "../index";

describe("@repo/cms content contract", () => {
  it("defaults to empty content", async () => {
    await expect(content.getBlogPosts()).resolves.toEqual([]);
    await expect(content.getLatestBlogPost()).resolves.toBeNull();
    await expect(content.getLegalPages()).resolves.toEqual([]);
  });

  it("creates a static provider-neutral content client", async () => {
    const client = createStaticContentClient({
      blogPosts: [
        {
          authors: [{ name: "AI Workflow OS" }],
          body: { readingTime: 3 },
          date: "2026-05-27",
          description: "A package boundary test.",
          slug: "package-boundary",
          title: "Package Boundary",
        },
      ],
      legalPages: [
        {
          body: { readingTime: 1 },
          description: "Privacy policy",
          slug: "privacy",
          title: "Privacy",
        },
      ],
    });

    await expect(client.getBlogPosts()).resolves.toEqual([
      {
        authors: [{ name: "AI Workflow OS" }],
        date: "2026-05-27",
        description: "A package boundary test.",
        slug: "package-boundary",
        title: "Package Boundary",
      },
    ]);
    await expect(client.getBlogPost("package-boundary")).resolves.toMatchObject({
      slug: "package-boundary",
    });
    await expect(client.getLegalPage("privacy")).resolves.toMatchObject({
      slug: "privacy",
    });
  });

  it("maps Payload Local API results into the provider-neutral content contract", async () => {
    const calls: unknown[] = [];
    const client = createPayloadContentClient({
      find: async (args) => {
        calls.push(args);

        if (args.collection === "legal-pages") {
          return {
            docs: [
              {
                body: { plainText: "Privacy body" },
                description: "Privacy policy",
                slug: "privacy",
                title: "Privacy",
              },
            ],
          };
        }

        return {
          docs: [
            {
              authors: [{ name: "AI Workflow OS" }],
              body: { plainText: "Post body", readingTime: 4 },
              categories: [{ name: "Research" }],
              description: "Payload-backed post.",
              image: {
                alt: "Cover",
                height: 1200,
                url: "https://cdn.example.com/cover.png",
                width: 2400,
              },
              publishedAt: "2026-05-27T00:00:00.000Z",
              slug: "payload-post",
              title: "Payload Post",
            },
          ],
        };
      },
    });

    await expect(client.getLatestBlogPost()).resolves.toMatchObject({
      authors: [{ name: "AI Workflow OS" }],
      body: { readingTime: 4 },
      categories: [{ name: "Research" }],
      image: { alt: "Cover" },
      slug: "payload-post",
    });
    await expect(client.getBlogPosts()).resolves.toEqual([
      {
        authors: [{ avatar: null, name: "AI Workflow OS", xUrl: null }],
        categories: [{ name: "Research" }],
        date: "2026-05-27T00:00:00.000Z",
        description: "Payload-backed post.",
        image: {
          alt: "Cover",
          blurDataURL: null,
          height: 1200,
          url: "https://cdn.example.com/cover.png",
          width: 2400,
        },
        slug: "payload-post",
        title: "Payload Post",
      },
    ]);
    await expect(client.getLegalPage("privacy")).resolves.toMatchObject({
      slug: "privacy",
    });
    expect(calls).toHaveLength(3);
  });
});
