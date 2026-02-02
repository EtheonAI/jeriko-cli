"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";

export const searchUsers = async (
  query: string
): Promise<
  | {
      data: string[];
    }
  | {
      error: unknown;
    }
> => {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (!session?.user) {
      throw new Error("Not logged in");
    }

    // TODO: Implement user search from database
    // For now, return empty array
    const data: string[] = [];

    return { data };
  } catch (error) {
    return { error };
  }
};
