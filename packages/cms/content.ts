export type ContentImage = {
  alt?: string | null;
  blurDataURL?: string | null;
  height: number;
  url: string;
  width: number;
};

export type ContentAuthor = {
  avatar?: ContentImage | null;
  name: string;
  xUrl?: string | null;
};

export type ContentCategory = {
  name: string;
};

export type RichTextContent = {
  plainText?: string;
  readingTime?: number;
  serialized?: unknown;
  tableOfContents?: unknown;
};

export type BlogPostMeta = {
  authors: ContentAuthor[];
  categories?: ContentCategory[];
  date: string;
  description: string;
  image?: ContentImage | null;
  slug: string;
  title: string;
};

export type BlogPost = BlogPostMeta & {
  body: RichTextContent;
};

export type LegalPageMeta = {
  description: string;
  slug: string;
  title: string;
};

export type LegalPage = LegalPageMeta & {
  body: RichTextContent;
};

export type CmsContentClient = {
  getBlogPost: (slug: string) => Promise<BlogPost | null>;
  getBlogPosts: () => Promise<BlogPostMeta[]>;
  getLatestBlogPost: () => Promise<BlogPost | null>;
  getLegalPage: (slug: string) => Promise<LegalPage | null>;
  getLegalPages: () => Promise<LegalPage[]>;
};

export type StaticContentInput = {
  blogPosts?: readonly BlogPost[];
  legalPages?: readonly LegalPage[];
};

type PayloadFindArgs = {
  collection: "legal-pages" | "posts";
  depth?: number;
  limit?: number;
  sort?: string;
  where?: Record<string, unknown>;
};

type PayloadFindResult = {
  docs?: unknown[];
};

export type PayloadContentReader = {
  find: (args: PayloadFindArgs) => Promise<PayloadFindResult>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const asOptionalString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asNumber = (value: unknown, fallback = 0) => (typeof value === "number" ? value : fallback);

const asRecordArray = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);

const extractImage = (value: unknown): ContentImage | null => {
  const image = isRecord(value) ? value : null;

  if (!image) {
    return null;
  }

  const url = asOptionalString(image.url);

  if (!url) {
    return null;
  }

  return {
    alt: asOptionalString(image.alt) ?? null,
    blurDataURL: asOptionalString(image.blurDataURL) ?? null,
    height: asNumber(image.height),
    url,
    width: asNumber(image.width),
  };
};

const extractRichText = (value: unknown): RichTextContent => {
  const body = isRecord(value) ? value : {};

  return {
    plainText: asOptionalString(body.plainText),
    readingTime: typeof body.readingTime === "number" ? body.readingTime : undefined,
    serialized: body.serialized ?? value,
    tableOfContents: body.tableOfContents,
  };
};

const extractAuthors = (value: unknown): ContentAuthor[] =>
  asRecordArray(value)
    .map((author) => ({
      avatar: extractImage(author.avatar),
      name: asString(author.name),
      xUrl: asOptionalString(author.xUrl) ?? null,
    }))
    .filter((author) => author.name.length > 0);

const extractCategories = (value: unknown): ContentCategory[] =>
  asRecordArray(value)
    .map((category) => ({ name: asString(category.name) }))
    .filter((category) => category.name.length > 0);

export const mapPayloadPost = (value: unknown): BlogPost | null => {
  const post = isRecord(value) ? value : null;

  if (!post) {
    return null;
  }

  const slug = asOptionalString(post.slug);
  const title = asOptionalString(post.title);

  if (!slug || !title) {
    return null;
  }

  return {
    authors: extractAuthors(post.authors),
    body: extractRichText(post.body),
    categories: extractCategories(post.categories),
    date:
      asOptionalString(post.publishedAt) ?? asOptionalString(post.date) ?? asString(post.createdAt),
    description: asString(post.description),
    image: extractImage(post.image),
    slug,
    title,
  };
};

export const mapPayloadLegalPage = (value: unknown): LegalPage | null => {
  const page = isRecord(value) ? value : null;

  if (!page) {
    return null;
  }

  const slug = asOptionalString(page.slug);
  const title = asOptionalString(page.title);

  if (!slug || !title) {
    return null;
  }

  return {
    body: extractRichText(page.body),
    description: asString(page.description),
    slug,
    title,
  };
};

const toBlogPostMeta = (post: BlogPost): BlogPostMeta => ({
  authors: post.authors,
  categories: post.categories,
  date: post.date,
  description: post.description,
  image: post.image,
  slug: post.slug,
  title: post.title,
});

const publishedWhere = {
  status: {
    equals: "published",
  },
};

export const createPayloadContentClient = (payload: PayloadContentReader): CmsContentClient => ({
  getBlogPost: async (slug) => {
    const result = await payload.find({
      collection: "posts",
      depth: 2,
      limit: 1,
      where: {
        and: [publishedWhere, { slug: { equals: slug } }],
      },
    });

    return mapPayloadPost(result.docs?.at(0)) ?? null;
  },
  getBlogPosts: async () => {
    const result = await payload.find({
      collection: "posts",
      depth: 2,
      limit: 100,
      sort: "-publishedAt",
      where: publishedWhere,
    });

    return (result.docs ?? [])
      .map(mapPayloadPost)
      .filter((post): post is BlogPost => post !== null)
      .map(toBlogPostMeta);
  },
  getLatestBlogPost: async () => {
    const result = await payload.find({
      collection: "posts",
      depth: 2,
      limit: 1,
      sort: "-publishedAt",
      where: publishedWhere,
    });

    return mapPayloadPost(result.docs?.at(0)) ?? null;
  },
  getLegalPage: async (slug) => {
    const result = await payload.find({
      collection: "legal-pages",
      depth: 1,
      limit: 1,
      where: {
        and: [publishedWhere, { slug: { equals: slug } }],
      },
    });

    return mapPayloadLegalPage(result.docs?.at(0)) ?? null;
  },
  getLegalPages: async () => {
    const result = await payload.find({
      collection: "legal-pages",
      depth: 1,
      limit: 100,
      sort: "title",
      where: publishedWhere,
    });

    return (result.docs ?? [])
      .map(mapPayloadLegalPage)
      .filter((page): page is LegalPage => page !== null);
  },
});

export const createStaticContentClient = ({
  blogPosts = [],
  legalPages = [],
}: StaticContentInput = {}): CmsContentClient => ({
  getBlogPost: async (slug) => blogPosts.find((post) => post.slug === slug) ?? null,
  getBlogPosts: async () => blogPosts.map(toBlogPostMeta),
  getLatestBlogPost: async () => blogPosts.at(0) ?? null,
  getLegalPage: async (slug) => legalPages.find((page) => page.slug === slug) ?? null,
  getLegalPages: async () => [...legalPages],
});

export const content = createStaticContentClient();
