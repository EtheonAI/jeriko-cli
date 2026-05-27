import type { CollectionConfig } from "payload";
import { firstCmsUserOrAdmin, isCmsAdmin } from "../access";

export const CmsUsers: CollectionConfig = {
  slug: "cms-users",
  access: {
    create: firstCmsUserOrAdmin,
    delete: isCmsAdmin,
    read: isCmsAdmin,
    update: isCmsAdmin,
  },
  admin: {
    defaultColumns: ["email", "role", "updatedAt"],
    group: "System",
    useAsTitle: "email",
  },
  auth: {
    forgotPassword: {
      expiration: 1000 * 60 * 60,
    },
  },
  fields: [
    {
      name: "role",
      type: "select",
      defaultValue: "editor",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
      ],
      required: true,
    },
  ],
};
