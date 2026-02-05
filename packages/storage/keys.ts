import { z } from "zod";

const storageConfigSchema = z.object({
  region: z.string().default("us-east-1"),
  bucket: z.string().default("rubic-files"),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  endpoint: z.string().optional(),
  forcePathStyle: z.boolean().default(false),
});

export type StorageConfig = z.infer<typeof storageConfigSchema>;

export function getStorageConfig(): StorageConfig {
  return storageConfigSchema.parse({
    region: process.env.AWS_REGION || "us-east-1",
    bucket: process.env.S3_BUCKET || "rubic-files",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });
}
