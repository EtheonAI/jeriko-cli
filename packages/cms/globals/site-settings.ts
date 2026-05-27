import type { GlobalConfig } from "payload";
import { isCmsEditor, publicRead } from "../access";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  access: {
    read: publicRead,
    update: isCmsEditor,
  },
  admin: {
    group: "Content",
  },
  fields: [
    {
      name: "siteName",
      type: "text",
      defaultValue: "Jeriko",
      required: true,
    },
    {
      name: "description",
      type: "textarea",
    },
    {
      name: "socialLinks",
      type: "array",
      fields: [
        {
          name: "label",
          type: "text",
          required: true,
        },
        {
          name: "url",
          type: "text",
          required: true,
        },
      ],
    },
  ],
};
