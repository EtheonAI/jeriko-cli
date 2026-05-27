import type { CollectionConfig } from "payload";
import { isCmsEditor, publicRead } from "../access";

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    create: isCmsEditor,
    delete: isCmsEditor,
    read: publicRead,
    update: isCmsEditor,
  },
  admin: {
    defaultColumns: ["filename", "alt", "updatedAt"],
    group: "Content",
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
    },
  ],
  upload: {
    adminThumbnail: "thumbnail",
    imageSizes: [
      {
        name: "thumbnail",
        height: 400,
        width: 400,
      },
      {
        name: "hero",
        height: 1200,
        width: 2400,
      },
    ],
    mimeTypes: ["image/*", "application/pdf"],
  },
};
