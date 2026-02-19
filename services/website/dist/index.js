var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/db.ts
var db_exports = {};
__export(db_exports, {
  and: () => and,
  asc: () => asc,
  db: () => db,
  desc: () => desc,
  eq: () => eq,
  initDb: () => initDb,
  or: () => or,
  sql: () => sql,
  websiteCrawlJobs: () => websiteCrawlJobs,
  websitePages: () => websitePages,
  websites: () => websites
});
import { eq, and, or, desc, asc, sql } from "drizzle-orm";
async function initDb() {
  const mod = await import("@repo/database");
  const resolved = mod.default ?? mod;
  db = resolved.db;
  websites = resolved.websites;
  websitePages = resolved.websitePages;
  websiteCrawlJobs = resolved.websiteCrawlJobs;
}
var db, websites, websitePages, websiteCrawlJobs;
var init_db = __esm({
  "src/lib/db.ts"() {
    "use strict";
  }
});

// src/index.ts
import { createService } from "@repo/service-utils";

// src/routes/websites.ts
init_db();
import { z } from "zod";
import {
  createId,
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger
} from "@repo/service-utils";
var logger = createLogger({ service: "website-routes" });
var FrameworkSchema = z.enum(["nextjs", "react", "vue", "svelte", "astro"]);
var CreateWebsiteSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  framework: FrameworkSchema.optional().default("nextjs"),
  templateId: z.string().optional()
});
var UpdateWebsiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  customDomain: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional()
});
var GenerateCodeSchema = z.object({
  prompt: z.string().min(1),
  targetFiles: z.array(z.string()).optional()
});
function getUserId(request) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    error.code = ErrorCodes.UNAUTHORIZED;
    throw error;
  }
  return userId;
}
var websiteRoutes = async (fastify) => {
  fastify.post("/websites", async (request, reply) => {
    const userId = getUserId(request);
    const input = CreateWebsiteSchema.parse(request.body);
    try {
      const id = createId();
      const [website] = await db.insert(websites).values({
        id,
        userId,
        name: input.name,
        description: input.description || null,
        url: "",
        domain: "",
        status: "pending",
        metadata: { framework: input.framework, templateId: input.templateId }
      }).returning();
      const templatePages = getTemplatePages(input.framework);
      for (const page of templatePages) {
        await db.insert(websitePages).values({
          id: createId(),
          websiteId: id,
          url: page.path,
          path: page.path,
          title: page.path,
          textContent: page.content,
          depth: 0
        });
      }
      logger.info({ websiteId: id, userId, framework: input.framework }, "Website created");
      return reply.status(201).send(
        successResponse(
          {
            id: website.id,
            userId: website.userId,
            name: website.name,
            description: website.description,
            framework: input.framework,
            status: website.status,
            files: templatePages.map((p) => ({ path: p.path, version: 1 })),
            createdAt: website.createdAt,
            updatedAt: website.updatedAt
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to create website");
      return reply.status(500).send(
        errorResponse(
          { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to create website" },
          request.id
        )
      );
    }
  });
  fastify.get("/websites", async (request, reply) => {
    const userId = getUserId(request);
    try {
      const userWebsites = await db.select().from(websites).where(eq(websites.userId, userId)).orderBy(desc(websites.createdAt));
      return reply.send(successResponse(userWebsites, request.id));
    } catch (error) {
      logger.error(error, "Failed to list websites");
      return reply.status(500).send(
        errorResponse(
          { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list websites" },
          request.id
        )
      );
    }
  });
  fastify.get("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const pages = await db.select({ path: websitePages.path }).from(websitePages).where(eq(websitePages.websiteId, id));
      return reply.send(
        successResponse(
          {
            ...website,
            files: pages.map((p) => ({ path: p.path, version: 1 }))
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to get website");
      return reply.status(500).send(
        errorResponse(
          { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get website" },
          request.id
        )
      );
    }
  });
  fastify.put("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const input = UpdateWebsiteSchema.parse(request.body);
    try {
      const [existing] = await db.select().from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!existing) {
        return reply.status(404).send(
          errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const updateValues = {};
      if (input.name) updateValues.name = input.name;
      if (input.description !== void 0) updateValues.description = input.description;
      if (input.settings)
        updateValues.config = { ...existing.config || {}, ...input.settings };
      const [updated] = await db.update(websites).set(updateValues).where(eq(websites.id, id)).returning();
      return reply.send(successResponse(updated, request.id));
    } catch (error) {
      logger.error(error, "Failed to update website");
      return reply.status(500).send(
        errorResponse(
          { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to update website" },
          request.id
        )
      );
    }
  });
  fastify.delete("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    try {
      const [deleted] = await db.delete(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).returning();
      if (!deleted) {
        return reply.status(404).send(
          errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      logger.info({ websiteId: id, userId }, "Website deleted");
      return reply.send(successResponse({ success: true }, request.id));
    } catch (error) {
      logger.error(error, "Failed to delete website");
      return reply.status(500).send(
        errorResponse(
          { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to delete website" },
          request.id
        )
      );
    }
  });
  fastify.post("/websites/:id/generate", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const input = GenerateCodeSchema.parse(request.body);
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      logger.info({ websiteId: id, prompt: input.prompt }, "Code generation requested");
      return reply.send(
        successResponse(
          {
            status: "generating",
            message: "AI code generation in progress"
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to generate code");
      return reply.status(500).send(
        errorResponse(
          { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to generate code" },
          request.id
        )
      );
    }
  });
  fastify.get("/websites/:id/files/*", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const path = "/" + request.params["*"];
    try {
      const [website] = await db.select({ id: websites.id }).from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const [page] = await db.select().from(websitePages).where(and(eq(websitePages.websiteId, id), eq(websitePages.path, path))).limit(1);
      if (!page) {
        return reply.status(404).send(
          errorResponse({ code: ErrorCodes.NOT_FOUND, message: "File not found" }, request.id)
        );
      }
      return reply.send(
        successResponse(
          {
            path: page.path,
            content: page.textContent || "",
            version: 1
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to get file");
      return reply.status(500).send(
        errorResponse(
          { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get file" },
          request.id
        )
      );
    }
  });
  fastify.put("/websites/:id/files/*", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const path = "/" + request.params["*"];
    const { content } = request.body;
    try {
      const [website] = await db.select({ id: websites.id }).from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const [existing] = await db.select().from(websitePages).where(and(eq(websitePages.websiteId, id), eq(websitePages.path, path))).limit(1);
      if (existing) {
        await db.update(websitePages).set({ textContent: content }).where(eq(websitePages.id, existing.id));
      } else {
        await db.insert(websitePages).values({
          id: createId(),
          websiteId: id,
          url: path,
          path,
          title: path,
          textContent: content,
          depth: 0
        });
      }
      logger.info({ websiteId: id, path }, "File updated");
      return reply.send(
        successResponse(
          {
            path,
            version: 1
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to update file");
      return reply.status(500).send(
        errorResponse(
          { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to update file" },
          request.id
        )
      );
    }
  });
  fastify.get("/websites/:id/files", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    try {
      const [website] = await db.select({ id: websites.id }).from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const pages = await db.select({ path: websitePages.path }).from(websitePages).where(eq(websitePages.websiteId, id));
      const files = pages.map((p) => ({ path: p.path, version: 1 }));
      return reply.send(successResponse(files, request.id));
    } catch (error) {
      logger.error(error, "Failed to list files");
      return reply.status(500).send(
        errorResponse(
          { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list files" },
          request.id
        )
      );
    }
  });
};
function getTemplatePages(framework) {
  if (framework === "nextjs") {
    return [
      {
        path: "/package.json",
        content: JSON.stringify(
          {
            name: "my-app",
            version: "0.1.0",
            private: true,
            scripts: {
              dev: "next dev",
              build: "next build",
              start: "next start"
            },
            dependencies: {
              next: "15.1.0",
              react: "19.0.0",
              "react-dom": "19.0.0"
            },
            devDependencies: {
              typescript: "^5.7.0",
              "@types/node": "^22.0.0",
              "@types/react": "^19.0.0"
            }
          },
          null,
          2
        )
      },
      {
        path: "/app/page.tsx",
        content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to your app</h1>
      <p className="mt-4 text-gray-600">Start editing app/page.tsx to begin.</p>
    </main>
  );
}`
      },
      {
        path: "/app/layout.tsx",
        content: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "My App",
  description: "Built with Rubic",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`
      },
      {
        path: "/app/globals.css",
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;`
      },
      {
        path: "/tailwind.config.ts",
        content: `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;`
      }
    ];
  }
  return [];
}

// src/routes/deploy.ts
init_db();
import {
  successResponse as successResponse2,
  errorResponse as errorResponse2,
  ErrorCodes as ErrorCodes2,
  createLogger as createLogger2,
  createId as createId2
} from "@repo/service-utils";
var logger2 = createLogger2({ service: "website-deploy" });
function getUserId2(request) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    error.code = ErrorCodes2.UNAUTHORIZED;
    throw error;
  }
  return userId;
}
var deployRoutes = async (fastify) => {
  fastify.post("/websites/:id/preview", async (request, reply) => {
    const userId = getUserId2(request);
    const { id } = request.params;
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse2({ code: ErrorCodes2.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      logger2.info({ websiteId: id, userId }, "Preview requested");
      return reply.send(
        successResponse2(
          {
            status: "starting",
            previewUrl: null,
            message: "Preview environment starting..."
          },
          request.id
        )
      );
    } catch (error) {
      logger2.error(error, "Failed to start preview");
      return reply.status(500).send(
        errorResponse2(
          { code: ErrorCodes2.INTERNAL_ERROR, message: "Failed to start preview" },
          request.id
        )
      );
    }
  });
  fastify.get("/websites/:id/preview/status", async (request, reply) => {
    const userId = getUserId2(request);
    const { id } = request.params;
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse2({ code: ErrorCodes2.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      return reply.send(
        successResponse2(
          {
            status: "ready",
            previewUrl: `https://preview-${id}.rubic.dev`
          },
          request.id
        )
      );
    } catch (error) {
      logger2.error(error, "Failed to get preview status");
      return reply.status(500).send(
        errorResponse2(
          { code: ErrorCodes2.INTERNAL_ERROR, message: "Failed to get preview status" },
          request.id
        )
      );
    }
  });
  fastify.post("/websites/:id/deploy", async (request, reply) => {
    const userId = getUserId2(request);
    const { id } = request.params;
    const body = request.body || {};
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse2({ code: ErrorCodes2.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const platform = body.platform || "vercel";
      const [deployment] = await db.insert(websiteCrawlJobs).values({
        id: createId2(),
        websiteId: id,
        status: "queued",
        config: { platform, deployedBy: userId }
      }).returning();
      logger2.info(
        { websiteId: id, deploymentId: deployment.id, platform, userId },
        "Deployment started"
      );
      return reply.status(202).send(
        successResponse2(
          {
            deploymentId: deployment.id,
            status: "queued",
            message: "Deployment started"
          },
          request.id
        )
      );
    } catch (error) {
      logger2.error(error, "Failed to deploy");
      return reply.status(500).send(
        errorResponse2(
          { code: ErrorCodes2.INTERNAL_ERROR, message: "Failed to deploy" },
          request.id
        )
      );
    }
  });
  fastify.get("/websites/:id/deployments/:deploymentId", async (request, reply) => {
    getUserId2(request);
    const { deploymentId } = request.params;
    try {
      const [deployment] = await db.select().from(websiteCrawlJobs).where(eq(websiteCrawlJobs.id, deploymentId)).limit(1);
      if (!deployment) {
        return reply.status(404).send(
          errorResponse2(
            { code: ErrorCodes2.NOT_FOUND, message: "Deployment not found" },
            request.id
          )
        );
      }
      return reply.send(successResponse2(deployment, request.id));
    } catch (error) {
      logger2.error(error, "Failed to get deployment");
      return reply.status(500).send(
        errorResponse2(
          { code: ErrorCodes2.INTERNAL_ERROR, message: "Failed to get deployment" },
          request.id
        )
      );
    }
  });
  fastify.get("/websites/:id/deployments", async (request, reply) => {
    getUserId2(request);
    const { id } = request.params;
    try {
      const deployments = await db.select().from(websiteCrawlJobs).where(eq(websiteCrawlJobs.websiteId, id)).orderBy(desc(websiteCrawlJobs.createdAt));
      return reply.send(successResponse2(deployments, request.id));
    } catch (error) {
      logger2.error(error, "Failed to list deployments");
      return reply.status(500).send(
        errorResponse2(
          { code: ErrorCodes2.INTERNAL_ERROR, message: "Failed to list deployments" },
          request.id
        )
      );
    }
  });
  fastify.post("/websites/:id/domain", async (request, reply) => {
    const userId = getUserId2(request);
    const { id } = request.params;
    const { domain } = request.body;
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, id), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse2({ code: ErrorCodes2.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      await db.update(websites).set({
        domain,
        metadata: {
          ...website.metadata || {},
          customDomainStatus: "pending_verification"
        }
      }).where(eq(websites.id, id));
      logger2.info({ websiteId: id, domain, userId }, "Custom domain configuration requested");
      return reply.send(
        successResponse2(
          {
            domain,
            status: "pending_verification",
            dnsRecords: [
              {
                type: "CNAME",
                name: domain,
                value: "cname.vercel-dns.com"
              }
            ],
            message: "Please add the DNS records to verify domain ownership"
          },
          request.id
        )
      );
    } catch (error) {
      logger2.error(error, "Failed to configure domain");
      return reply.status(500).send(
        errorResponse2(
          { code: ErrorCodes2.INTERNAL_ERROR, message: "Failed to configure domain" },
          request.id
        )
      );
    }
  });
};

// src/routes/database.ts
init_db();
import {
  successResponse as successResponse3,
  errorResponse as errorResponse3,
  ErrorCodes as ErrorCodes3,
  createLogger as createLogger3,
  createId as createId3
} from "@repo/service-utils";
var logger3 = createLogger3({ service: "website-database" });
function getUserId3(request) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    error.code = ErrorCodes3.UNAUTHORIZED;
    throw error;
  }
  return userId;
}
var databaseRoutes = async (fastify) => {
  fastify.post("/websites/:id/database", async (request, reply) => {
    const userId = getUserId3(request);
    const { id: websiteId } = request.params;
    const body = request.body || {};
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, websiteId), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const existingMeta = website.metadata || {};
      if (existingMeta.databaseId) {
        return reply.status(409).send(
          errorResponse3(
            { code: "DATABASE_EXISTS", message: "Database already provisioned" },
            request.id
          )
        );
      }
      const provider = body.provider || "tidb";
      const dbId = createId3();
      await db.update(websites).set({
        metadata: {
          ...existingMeta,
          databaseId: dbId,
          databaseProvider: provider,
          databaseStatus: "provisioning"
        }
      }).where(eq(websites.id, websiteId));
      logger3.info(
        { websiteId, databaseId: dbId, provider, userId },
        "Database provisioning started"
      );
      return reply.status(202).send(
        successResponse3(
          {
            databaseId: dbId,
            status: "provisioning",
            message: "Database provisioning started"
          },
          request.id
        )
      );
    } catch (error) {
      logger3.error(error, "Failed to provision database");
      return reply.status(500).send(
        errorResponse3(
          { code: ErrorCodes3.INTERNAL_ERROR, message: "Failed to provision database" },
          request.id
        )
      );
    }
  });
  fastify.get("/websites/:id/database", async (request, reply) => {
    const userId = getUserId3(request);
    const { id: websiteId } = request.params;
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, websiteId), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const meta = website.metadata || {};
      if (!meta.databaseId) {
        return reply.status(404).send(
          errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Database not found" }, request.id)
        );
      }
      return reply.send(
        successResponse3(
          {
            id: meta.databaseId,
            websiteId,
            provider: meta.databaseProvider,
            status: meta.databaseStatus,
            host: meta.databaseHost || null,
            port: meta.databasePort || null,
            databaseName: meta.databaseName || null,
            connectionString: meta.databaseStatus === "ready" ? "[HIDDEN - Use CLI to retrieve]" : null
          },
          request.id
        )
      );
    } catch (error) {
      logger3.error(error, "Failed to get database info");
      return reply.status(500).send(
        errorResponse3(
          { code: ErrorCodes3.INTERNAL_ERROR, message: "Failed to get database info" },
          request.id
        )
      );
    }
  });
  fastify.delete("/websites/:id/database", async (request, reply) => {
    const userId = getUserId3(request);
    const { id: websiteId } = request.params;
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, websiteId), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const meta = website.metadata || {};
      if (!meta.databaseId) {
        return reply.status(404).send(
          errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Database not found" }, request.id)
        );
      }
      const {
        databaseId,
        databaseProvider,
        databaseStatus,
        databaseHost,
        databasePort,
        databaseName,
        ...restMeta
      } = meta;
      await db.update(websites).set({ metadata: restMeta }).where(eq(websites.id, websiteId));
      logger3.info({ websiteId, databaseId: meta.databaseId, userId }, "Database deleted");
      return reply.send(successResponse3({ success: true }, request.id));
    } catch (error) {
      logger3.error(error, "Failed to delete database");
      return reply.status(500).send(
        errorResponse3(
          { code: ErrorCodes3.INTERNAL_ERROR, message: "Failed to delete database" },
          request.id
        )
      );
    }
  });
  fastify.post("/websites/:id/database/branch", async (request, reply) => {
    const userId = getUserId3(request);
    const { id: websiteId } = request.params;
    const { branchName } = request.body;
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, websiteId), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const meta = website.metadata || {};
      if (!meta.databaseId) {
        return reply.status(404).send(
          errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Database not found" }, request.id)
        );
      }
      logger3.info({ websiteId, branchName, userId }, "Database branch creation requested");
      return reply.send(
        successResponse3(
          {
            branchName,
            status: "creating",
            message: "Database branch creation started"
          },
          request.id
        )
      );
    } catch (error) {
      logger3.error(error, "Failed to create database branch");
      return reply.status(500).send(
        errorResponse3(
          { code: ErrorCodes3.INTERNAL_ERROR, message: "Failed to create branch" },
          request.id
        )
      );
    }
  });
  fastify.post("/websites/:id/database/execute", async (request, reply) => {
    const userId = getUserId3(request);
    const { id: websiteId } = request.params;
    const { sql: sqlQuery } = request.body;
    try {
      const [website] = await db.select().from(websites).where(and(eq(websites.id, websiteId), eq(websites.userId, userId))).limit(1);
      if (!website) {
        return reply.status(404).send(
          errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Website not found" }, request.id)
        );
      }
      const meta = website.metadata || {};
      if (!meta.databaseId || meta.databaseStatus !== "ready") {
        return reply.status(404).send(
          errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Database not ready" }, request.id)
        );
      }
      const forbiddenKeywords = ["DROP DATABASE", "DROP USER", "GRANT", "REVOKE"];
      const upperSql = sqlQuery.toUpperCase();
      for (const keyword of forbiddenKeywords) {
        if (upperSql.includes(keyword)) {
          return reply.status(403).send(
            errorResponse3(
              { code: "FORBIDDEN_SQL", message: `SQL contains forbidden keyword: ${keyword}` },
              request.id
            )
          );
        }
      }
      logger3.info({ websiteId, userId }, "SQL execution requested");
      return reply.send(
        successResponse3(
          {
            executed: true,
            message: "SQL executed successfully (placeholder)"
          },
          request.id
        )
      );
    } catch (error) {
      logger3.error(error, "Failed to execute SQL");
      return reply.status(500).send(
        errorResponse3(
          { code: ErrorCodes3.INTERNAL_ERROR, message: "Failed to execute SQL" },
          request.id
        )
      );
    }
  });
};

// src/index.ts
async function main() {
  const { initDb: initDb2 } = await Promise.resolve().then(() => (init_db(), db_exports));
  await initDb2();
  const { app, logger: _logger, start } = await createService({
    name: "website",
    port: parseInt(process.env.PORT || "4004", 10),
    cors: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : false
  });
  await app.register(websiteRoutes);
  await app.register(deployRoutes);
  await app.register(databaseRoutes);
  await start();
}
main();
//# sourceMappingURL=index.js.map