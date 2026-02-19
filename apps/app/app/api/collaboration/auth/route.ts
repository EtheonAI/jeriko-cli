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
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Use user ID as orgId for now (can be updated when organizations are fully implemented)
    const orgId = session.user.id;

    // Liveblocks enforces a 2048-byte limit on userInfo.
    // Only send essential fields. Skip avatar if it's a data URI or too long.
    const rawAvatar = session.user.image;
    const avatar =
      typeof rawAvatar === "string" &&
      rawAvatar.length <= 500 &&
      !rawAvatar.startsWith("data:")
        ? rawAvatar
        : undefined;

    return authenticate({
      userId: session.user.id,
      orgId,
      userInfo: {
        name: (session.user.name ?? session.user.email ?? "User").slice(0, 100),
        avatar,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      },
    });
  } catch {
    // Liveblocks auth failed (invalid/expired key, network error, etc.)
    return new Response("Collaboration auth unavailable", { status: 503 });
  }
};
