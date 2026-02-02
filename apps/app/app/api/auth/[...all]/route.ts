import { auth } from "@repo/auth/server";

const handler = auth.handler;

export { handler as GET, handler as POST };
