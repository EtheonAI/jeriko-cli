export type ContentImage = {
  alt?: string | null;
  height: number;
  url: string;
  width: number;
};

export type BlogPostMeta = {
  _slug: string;
  _title: string;
  authors: {
    _title: string;
  }[];
  date: string;
  description: string;
  image: ContentImage;
};

export type BlogPost = BlogPostMeta & {
  body: {
    readingTime: number;
  };
};

export type LegalPage = {
  _slug: string;
  _title: string;
  description: string;
  body: {
    readingTime: number;
  };
};

const blogPosts: BlogPost[] = [];
const legalPages: LegalPage[] = [];

export const getBlogPosts = async (): Promise<BlogPostMeta[]> => blogPosts;

export const getLatestBlogPost = async (): Promise<BlogPost | null> => blogPosts.at(0) ?? null;

export const getBlogPost = async (slug: string): Promise<BlogPost | null> =>
  blogPosts.find((post) => post._slug === slug) ?? null;

export const getLegalPages = async (): Promise<LegalPage[]> => legalPages;

export const getLegalPage = async (slug: string): Promise<LegalPage | null> =>
  legalPages.find((page) => page._slug === slug) ?? null;
