import { db, sql } from "@repo/database";

export const GET = async () => {
  await db.execute(sql`select 1`);

  return new Response("OK", { status: 200 });
};
