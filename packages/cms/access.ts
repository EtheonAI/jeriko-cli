import type { Access, Where } from "payload";

const CMS_ROLES = ["admin", "editor"] as const;

export type CmsRole = (typeof CMS_ROLES)[number];

type CmsUserShape = {
  role?: unknown;
  roles?: unknown;
};

const isCmsRole = (value: unknown): value is CmsRole =>
  typeof value === "string" && CMS_ROLES.includes(value as CmsRole);

const getCmsRoles = (user: unknown): CmsRole[] => {
  const candidate = typeof user === "object" && user !== null ? (user as CmsUserShape) : null;

  if (!candidate) {
    return [];
  }

  const roles = Array.isArray(candidate.roles) ? candidate.roles.filter(isCmsRole) : [];

  return isCmsRole(candidate.role) ? [candidate.role, ...roles] : roles;
};

export const hasCmsRole = (user: unknown, allowedRoles: readonly CmsRole[]) => {
  const roles = getCmsRoles(user);

  return roles.some((role) => allowedRoles.includes(role));
};

export const publishedWhere: Where = {
  status: {
    equals: "published",
  },
};

export const publicRead: Access = () => true;

export const isAuthenticated: Access = ({ req }) => Boolean(req.user);

export const isCmsAdmin: Access = ({ req }) => hasCmsRole(req.user, ["admin"]);

export const isCmsEditor: Access = ({ req }) => hasCmsRole(req.user, ["admin", "editor"]);

export const publishedOrCmsEditor: Access = ({ req }) =>
  hasCmsRole(req.user, ["admin", "editor"]) ? true : publishedWhere;

export const firstCmsUserOrAdmin: Access = async ({ req }) => {
  if (hasCmsRole(req.user, ["admin"])) {
    return true;
  }

  const result = await req.payload.count({
    collection: "cms-users",
    overrideAccess: true,
  });

  return result.totalDocs === 0;
};
