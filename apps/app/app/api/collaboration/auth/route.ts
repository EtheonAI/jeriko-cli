import { auth } from "@repo/auth";
import { authenticate } from "@repo/collaboration/auth";
import { headers } from "next/headers";

const COLORS = [
  "var(--color-red-500)",
  "var(--color-orange-500)",
  "var(--color-amber-500)",
  "var(--color-yellow-500)",
  "var(--color-lime-500)",
  "var(--color-green-500)",
  "var(--color-emerald-500)",
  "var(--color-teal-500)",
  "var(--color-cyan-500)",
  "var(--color-sky-500)",
  "var(--color-blue-500)",
  "var(--color-indigo-500)",
  "var(--color-violet-500)",
  "var(--color-purple-500)",
  "var(--color-fuchsia-500)",
  "var(--color-pink-500)",
  "var(--color-rose-500)",
];

export const POST = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Use user ID as orgId for now (can be updated when organizations are fully implemented)
  const orgId = session.user.id;

  return authenticate({
    userId: session.user.id,
    orgId,
    userInfo: {
      name: session.user.name ?? session.user.email ?? "User",
      avatar: session.user.image ?? undefined,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    },
  });
};
