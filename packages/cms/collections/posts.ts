import type { CollectionConfig } from "payload";
import { isCmsEditor, publishedOrCmsEditor } from "../access";

export const Posts: CollectionConfig = {
  slug: "posts",
  access: {
    create: isCmsEditor,
    delete: isCmsEditor,
    read: publishedOrCmsEditor,
    update: isCmsEditor,
  },
  admin: {
    defaultColumns: ["title", "slug", "status", "publishedAt"],
    group: "Content",
    useAsTitle: "title",
  },
  defaultSort: "-publishedAt",
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
      name: "publishedAt",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
    },
    {
      name: "image",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "authors",
      type: "array",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
        },
        {
          name: "xUrl",
          type: "text",
        },
        {
          name: "avatar",
          type: "upload",
          relationTo: "media",
        },
      ],
    },
    {
      name: "categories",
      type: "array",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
        },
      ],
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
