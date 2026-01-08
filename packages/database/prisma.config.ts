import { defineConfig } from "prisma/config";
import { keys } from "./keys";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: "postgresql://neondb_owner:npg_S51gLVmcBbpx@ep-odd-glade-a4py0ovv-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  },
});