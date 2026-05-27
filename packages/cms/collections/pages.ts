import type { CollectionConfig } from "payload";
import { isCmsEditor, publishedOrCmsEditor } from "../access";

export const Pages: CollectionConfig = {
  slug: "pages",
  access: {
    create: isCmsEditor,
    delete: isCmsEditor,
    read: publishedOrCmsEditor,
    update: isCmsEditor,
  },
  admin: {
    defaultColumns: ["title", "slug", "status", "updatedAt"],
    group: "Content",
    useAsTitle: "title",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      index: true,
      required: true,
      unique: true,
    },
    {
      name: "description",
      type: "textarea",
      required: true,
    },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      index: true,
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
      required: true,
    },
    {
      name: "body",
      type: "richText",
      required: true,
    },
  ],
  versions: {
    drafts: true,
    maxPerDoc: 30,
  },
};
