import "server-only";
import { auth } from "@repo/auth";
import { Svix } from "svix";
import { keys } from "../keys";

const svixToken = keys().SVIX_TOKEN;

export const send = async (eventType: string, payload: object) => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);
  const { user } = await auth();

  if (!user) {
    return;
  }

  return svix.message.create(user?.userId, {
    eventType,
    payload: {
      eventType,
      ...payload,
    },
    application: {
      name: user?.userId,
      uid: user?.userId,
    },
  });
};

export const getAppPortal = async () => {
  if (!svixToken) {
    throw new Error("SVIX_TOKEN is not set");
  }

  const svix = new Svix(svixToken);
  const session = await auth();

  if (!user?.userId) {
    return;
  }

  return svix.authentication.appPortalAccess(user.userId, {
    application: {
      name: user.userId,
      uid: user.userId,
    },
  });
};
