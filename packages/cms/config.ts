import "server-only";

import path from "node:path";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { resendAdapter } from "@payloadcms/email-resend";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import { buildConfig, type Plugin } from "payload";
import sharp from "sharp";
import { cmsCollections } from "./collections";
import { cmsGlobals } from "./globals";
import { keys } from "./keys";

export type PayloadEmailOptions = {
  apiKey: string;
  defaultFromAddress: string;
  defaultFromName?: string;
};

export type CreatePayloadConfigOptions = {
  blobReadWriteToken?: string;
  databaseUrl: string;
  email?: PayloadEmailOptions;
  generatedGraphqlSchemaPath?: string;
  generatedTypesPath?: string;
  migrationDir?: string;
  schemaName?: string;
  secret: string;
  serverURL?: string;
};

const getGeneratedPath = (fileName: string) => path.resolve(process.cwd(), fileName);

export const createPayloadConfig = ({
  blobReadWriteToken,
  databaseUrl,
  email,
  generatedGraphqlSchemaPath,
  generatedTypesPath,
  migrationDir,
  schemaName,
  secret,
  serverURL,
}: CreatePayloadConfigOptions) => {
  const plugins: Plugin[] = [];

  if (blobReadWriteToken) {
    plugins.push(
      vercelBlobStorage({
        clientUploads: true,
        collections: {
          media: true,
        },
        token: blobReadWriteToken,
      })
    );
  }

  return buildConfig({
    admin: {
      user: "cms-users",
    },
    collections: cmsCollections,
    db: postgresAdapter({
      migrationDir: migrationDir ?? getGeneratedPath("payload-migrations"),
      pool: {
        connectionString: databaseUrl,
      },
      schemaName,
    }),
    editor: lexicalEditor(),
    globals: cmsGlobals,
    graphQL: {
      schemaOutputFile:
        generatedGraphqlSchemaPath ?? getGeneratedPath("payload-generated-schema.graphql"),
    },
    plugins,
    secret,
    serverURL,
    sharp,
    ...(email?.apiKey && email.defaultFromAddress
      ? {
          email: resendAdapter({
            apiKey: email.apiKey,
            defaultFromAddress: email.defaultFromAddress,
            defaultFromName: email.defaultFromName ?? "Jeriko CMS",
          }),
        }
      : {}),
    typescript: {
      outputFile: generatedTypesPath ?? getGeneratedPath("payload-generated-types.ts"),
    },
  });
};

export const createPayloadConfigFromEnv = () => {
  const env = keys();

  if (!env.PAYLOAD_DATABASE_URL) {
    throw new Error("PAYLOAD_DATABASE_URL is required to initialize Payload.");
  }

  if (!env.PAYLOAD_SECRET) {
    throw new Error("PAYLOAD_SECRET is required to initialize Payload.");
  }

  return createPayloadConfig({
    blobReadWriteToken: env.BLOB_READ_WRITE_TOKEN,
    databaseUrl: env.PAYLOAD_DATABASE_URL,
    email:
      env.RESEND_API_KEY && env.PAYLOAD_EMAIL_FROM_ADDRESS
        ? {
            apiKey: env.RESEND_API_KEY,
            defaultFromAddress: env.PAYLOAD_EMAIL_FROM_ADDRESS,
            defaultFromName: env.PAYLOAD_EMAIL_FROM_NAME,
          }
        : undefined,
    schemaName: env.PAYLOAD_POSTGRES_SCHEMA,
    secret: env.PAYLOAD_SECRET,
    serverURL: env.PAYLOAD_SERVER_URL,
  });
};
