import { getFlags } from "@repo/feature-flags/access";

export const GET = async (request: Request): Promise<Response> => {
  return getFlags(request);
};
