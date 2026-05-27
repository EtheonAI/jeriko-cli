import type { CollectionConfig } from "payload";
import { CmsUsers } from "./cms-users";
import { LegalPages } from "./legal-pages";
import { Media } from "./media";
import { Pages } from "./pages";
import { Posts } from "./posts";

export const cmsCollections: CollectionConfig[] = [CmsUsers, Media, Pages, Posts, LegalPages];

export { CmsUsers, LegalPages, Media, Pages, Posts };
