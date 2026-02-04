// src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createLogger as createLogger4, getEnv } from "@repo/service-utils";

// src/routes/websites.ts
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
  settings: z.record(z.unknown()).optional()
});
var GenerateCodeSchema = z.object({
  prompt: z.string().min(1),
  targetFiles: z.array(z.string()).optional()
});
var websites = /* @__PURE__ */ new Map();
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
    const id = createId();
    const now = /* @__PURE__ */ new Date();
    const website = {
      id,
      userId,
      name: input.name,
      description: input.description || null,
      framework: input.framework,
      previewUrl: null,
      productionUrl: null,
      customDomain: null,
      status: "draft",
      settings: {},
      files: /* @__PURE__ */ new Map(),
      createdAt: now,
      updatedAt: now
    };
    initializeTemplate(website, input.framework, input.templateId);
    websites.set(id, website);
    logger.info({ websiteId: id, userId, framework: input.framework }, "Website created");
    return reply.status(201).send(successResponse({
      ...website,
      files: Array.from(website.files.entries()).map(([path, file]) => ({
        path,
        version: file.version
      }))
    }, request.id));
  });
  fastify.get("/websites", async (request, reply) => {
    const userId = getUserId(request);
    const userWebsites = Array.from(websites.values()).filter((w) => w.userId === userId).map((w) => ({
      ...w,
      files: void 0
      // Don't include files in list
    }));
    return reply.send(successResponse(userWebsites, request.id));
  });
  fastify.get("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }
    return reply.send(successResponse({
      ...website,
      files: Array.from(website.files.entries()).map(([path, file]) => ({
        path,
        version: file.version
      }))
    }, request.id));
  });
  fastify.put("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const input = UpdateWebsiteSchema.parse(request.body);
    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }
    if (input.name) website.name = input.name;
    if (input.description !== void 0) website.description = input.description;
    if (input.customDomain !== void 0) website.customDomain = input.customDomain;
    if (input.settings) website.settings = { ...website.settings, ...input.settings };
    website.updatedAt = /* @__PURE__ */ new Date();
    return reply.send(successResponse(website, request.id));
  });
  fastify.delete("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }
    websites.delete(id);
    logger.info({ websiteId: id, userId }, "Website deleted");
    return reply.send(successResponse({ success: true }, request.id));
  });
  fastify.post("/websites/:id/generate", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const input = GenerateCodeSchema.parse(request.body);
    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }
    logger.info({ websiteId: id, prompt: input.prompt }, "Code generation requested");
    return reply.send(successResponse({
      status: "generating",
      message: "AI code generation in progress"
      // In production, this would stream updates via WebSocket
    }, request.id));
  });
  fastify.get("/websites/:id/files/*", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const path = "/" + request.params["*"];
    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }
    const file = website.files.get(path);
    if (!file) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "File not found" }, request.id)
      );
    }
    return reply.send(successResponse({
      path,
      content: file.content,
      version: file.version
    }, request.id));
  });
  fastify.put("/websites/:id/files/*", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const path = "/" + request.params["*"];
    const { content } = request.body;
    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }
    const existing = website.files.get(path);
    website.files.set(path, {
      content,
      version: (existing?.version || 0) + 1
    });
    website.updatedAt = /* @__PURE__ */ new Date();
    logger.info({ websiteId: id, path }, "File updated");
    return reply.send(successResponse({
      path,
      version: website.files.get(path).version
    }, request.id));
  });
  fastify.get("/websites/:id/files", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }
    const files = Array.from(website.files.entries()).map(([path, file]) => ({
      path,
      version: file.version
    }));
    return reply.send(successResponse(files, request.id));
  });
};
function initializeTemplate(website, framework, templateId) {
  if (framework === "nextjs") {
    website.files.set("/package.json", {
      content: JSON.stringify({
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
      }, null, 2),
      version: 1
    });
    website.files.set("/app/page.tsx", {
      content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to your app</h1>
      <p className="mt-4 text-gray-600">Start editing app/page.tsx to begin.</p>
    </main>
  );
}`,
      version: 1
    });
    website.files.set("/app/layout.tsx", {
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
}`,
      version: 1
    });
    website.files.set("/app/globals.css", {
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      version: 1
    });
    website.files.set("/tailwind.config.ts", {
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

export default config;`,
      version: 1
    });
  }
}

// src/routes/deploy.ts
import {
  successResponse as successResponse2,
  errorResponse as errorResponse2,
  ErrorCodes as ErrorCodes2,
  createLogger as createLogger2,
  createId as createId2
} from "@repo/service-utils";
var logger2 = createLogger2({ service: "website-deploy" });
var deployments = /* @__PURE__ */ new Map();
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
    logger2.info({ websiteId: id, userId }, "Preview requested");
    return reply.send(successResponse2({
      status: "starting",
      previewUrl: null,
      // Would be set when preview is ready
      message: "Preview environment starting..."
    }, request.id));
  });
  fastify.get("/websites/:id/preview/status", async (request, reply) => {
    const userId = getUserId2(request);
    const { id } = request.params;
    return reply.send(successResponse2({
      status: "ready",
      previewUrl: `https://preview-${id}.rubic.dev`
    }, request.id));
  });
  fastify.post("/websites/:id/deploy", async (request, reply) => {
    const userId = getUserId2(request);
    const { id } = request.params;
    const body = request.body || {};
    const platform = body.platform || "vercel";
    const deploymentId = createId2();
    const deployment = {
      id: deploymentId,
      websiteId: id,
      platform,
      status: "queued",
      url: null,
      buildLogs: ["Deployment queued..."],
      createdAt: /* @__PURE__ */ new Date(),
      completedAt: null
    };
    deployments.set(deploymentId, deployment);
    logger2.info({ websiteId: id, deploymentId, platform, userId }, "Deployment started");
    setTimeout(() => {
      const d = deployments.get(deploymentId);
      if (d) {
        d.status = "building";
        d.buildLogs.push("Installing dependencies...");
      }
    }, 1e3);
    setTimeout(() => {
      const d = deployments.get(deploymentId);
      if (d) {
        d.buildLogs.push("Building application...");
      }
    }, 3e3);
    setTimeout(() => {
      const d = deployments.get(deploymentId);
      if (d) {
        d.status = "ready";
        d.url = `https://${id}.vercel.app`;
        d.buildLogs.push("Deployment complete!");
        d.completedAt = /* @__PURE__ */ new Date();
      }
    }, 5e3);
    return reply.status(202).send(successResponse2({
      deploymentId,
      status: "queued",
      message: "Deployment started"
    }, request.id));
  });
  fastify.get("/websites/:id/deployments/:deploymentId", async (request, reply) => {
    const userId = getUserId2(request);
    const { deploymentId } = request.params;
    const deployment = deployments.get(deploymentId);
    if (!deployment) {
      return reply.status(404).send(
        errorResponse2({ code: ErrorCodes2.NOT_FOUND, message: "Deployment not found" }, request.id)
      );
    }
    return reply.send(successResponse2(deployment, request.id));
  });
  fastify.get("/websites/:id/deployments", async (request, reply) => {
    const userId = getUserId2(request);
    const { id } = request.params;
    const websiteDeployments = Array.from(deployments.values()).filter((d) => d.websiteId === id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return reply.send(successResponse2(websiteDeployments, request.id));
  });
  fastify.post("/websites/:id/domain", async (request, reply) => {
    const userId = getUserId2(request);
    const { id } = request.params;
    const { domain } = request.body;
    logger2.info({ websiteId: id, domain, userId }, "Custom domain configuration requested");
    return reply.send(successResponse2({
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
    }, request.id));
  });
};

// src/routes/database.ts
import {
  successResponse as successResponse3,
  errorResponse as errorResponse3,
  ErrorCodes as ErrorCodes3,
  createLogger as createLogger3,
  createId as createId3
} from "@repo/service-utils";
var logger3 = createLogger3({ service: "website-database" });
var databases = /* @__PURE__ */ new Map();
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
    const provider = body.provider || "tidb";
    const dbId = createId3();
    const existing = Array.from(databases.values()).find((d) => d.websiteId === websiteId);
    if (existing) {
      return reply.status(409).send(
        errorResponse3({ code: "DATABASE_EXISTS", message: "Database already provisioned" }, request.id)
      );
    }
    const database = {
      id: dbId,
      websiteId,
      provider,
      status: "provisioning",
      host: null,
      port: null,
      databaseName: null,
      username: null,
      connectionString: null,
      createdAt: /* @__PURE__ */ new Date()
    };
    databases.set(dbId, database);
    logger3.info({ websiteId, databaseId: dbId, provider, userId }, "Database provisioning started");
    setTimeout(() => {
      const db = databases.get(dbId);
      if (db) {
        db.status = "ready";
        db.host = `gateway01.us-east-1.prod.aws.tidbcloud.com`;
        db.port = 4e3;
        db.databaseName = `rubic_${websiteId.slice(0, 8)}`;
        db.username = `app_${websiteId.slice(0, 8)}`;
        db.connectionString = `mysql://${db.username}:****@${db.host}:${db.port}/${db.databaseName}?ssl=true`;
      }
    }, 3e3);
    return reply.status(202).send(successResponse3({
      databaseId: dbId,
      status: "provisioning",
      message: "Database provisioning started"
    }, request.id));
  });
  fastify.get("/websites/:id/database", async (request, reply) => {
    const userId = getUserId3(request);
    const { id: websiteId } = request.params;
    const database = Array.from(databases.values()).find((d) => d.websiteId === websiteId);
    if (!database) {
      return reply.status(404).send(
        errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Database not found" }, request.id)
      );
    }
    return reply.send(successResponse3({
      ...database,
      connectionString: database.status === "ready" ? "[HIDDEN - Use CLI to retrieve]" : null
    }, request.id));
  });
  fastify.delete("/websites/:id/database", async (request, reply) => {
    const userId = getUserId3(request);
    const { id: websiteId } = request.params;
    const database = Array.from(databases.values()).find((d) => d.websiteId === websiteId);
    if (!database) {
      return reply.status(404).send(
        errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Database not found" }, request.id)
      );
    }
    databases.delete(database.id);
    logger3.info({ websiteId, databaseId: database.id, userId }, "Database deleted");
    return reply.send(successResponse3({ success: true }, request.id));
  });
  fastify.post("/websites/:id/database/branch", async (request, reply) => {
    const userId = getUserId3(request);
    const { id: websiteId } = request.params;
    const { branchName } = request.body;
    const database = Array.from(databases.values()).find((d) => d.websiteId === websiteId);
    if (!database) {
      return reply.status(404).send(
        errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Database not found" }, request.id)
      );
    }
    logger3.info({ websiteId, branchName, userId }, "Database branch creation requested");
    return reply.send(successResponse3({
      branchName,
      status: "creating",
      message: "Database branch creation started"
    }, request.id));
  });
  fastify.post("/websites/:id/database/execute", async (request, reply) => {
    const userId = getUserId3(request);
    const { id: websiteId } = request.params;
    const { sql } = request.body;
    const database = Array.from(databases.values()).find((d) => d.websiteId === websiteId);
    if (!database || database.status !== "ready") {
      return reply.status(404).send(
        errorResponse3({ code: ErrorCodes3.NOT_FOUND, message: "Database not ready" }, request.id)
      );
    }
    const forbiddenKeywords = ["DROP DATABASE", "DROP USER", "GRANT", "REVOKE"];
    const upperSql = sql.toUpperCase();
    for (const keyword of forbiddenKeywords) {
      if (upperSql.includes(keyword)) {
        return reply.status(403).send(
          errorResponse3({ code: "FORBIDDEN_SQL", message: `SQL contains forbidden keyword: ${keyword}` }, request.id)
        );
      }
    }
    logger3.info({ websiteId, userId }, "SQL execution requested");
    return reply.send(successResponse3({
      executed: true,
      message: "SQL executed successfully (placeholder)"
    }, request.id));
  });
};

// src/index.ts
var logger4 = createLogger4({ service: "website" });
async function main() {
  const port = parseInt(getEnv("PORT", "3004"), 10);
  const host = getEnv("HOST", "0.0.0.0");
  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID()
  });
  await app.register(cors, {
    origin: true,
    credentials: true
  });
  app.get("/health", async () => ({ status: "ok", service: "website" }));
  await app.register(websiteRoutes);
  await app.register(deployRoutes);
  await app.register(databaseRoutes);
  app.addHook("onRequest", async (request) => {
    logger4.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      userId: request.headers["x-user-id"]
    }, "Incoming request");
  });
  try {
    await app.listen({ port, host });
    logger4.info({ port, host }, "Website service started");
  } catch (err) {
    logger4.error(err, "Failed to start server");
    process.exit(1);
  }
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger4.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}
main();
//# sourceMappingURL=index.js.map