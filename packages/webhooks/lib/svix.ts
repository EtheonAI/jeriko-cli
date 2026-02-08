import "server-only";
import { auth } from "@repo/auth";
import { Svix } from "svix";
import { headers } from "next/headers";
import { keys } from "../keys";

const svixToken = keys().SVIX_TOKEN;

export const send = async (eventType: string, payload: object) => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  const user = session?.user;

  if (!user?.id) {
    return;
  }

  return svix.message.create(user.id, {
    eventType,
    payload: {
      eventType,
      ...payload,
    },
    application: {
      name: user.id,
      uid: user.id,
    },
  });
};

export const getAppPortal = async () => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  const user = session?.user;

  if (!user?.id) {
    return;
  }

  return svix.authentication.appPortalAccess(user.id, {
    application: {
      name: user.id,
      uid: user.id,
    },
  });
};
