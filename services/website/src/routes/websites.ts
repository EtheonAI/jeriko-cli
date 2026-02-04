import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createId,
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
} from "@repo/service-utils";

const logger = createLogger({ service: "website-routes" });

// Schemas
const FrameworkSchema = z.enum(["nextjs", "react", "vue", "svelte", "astro"]);

const CreateWebsiteSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  framework: FrameworkSchema.optional().default("nextjs"),
  templateId: z.string().optional(),
});

const UpdateWebsiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  customDomain: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

const GenerateCodeSchema = z.object({
  prompt: z.string().min(1),
  targetFiles: z.array(z.string()).optional(),
});

// In-memory store (use database in production)
const websites = new Map<string, {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  framework: string;
  previewUrl: string | null;
  productionUrl: string | null;
  customDomain: string | null;
  status: string;
  settings: Record<string, unknown>;
  files: Map<string, { content: string; version: number }>;
  createdAt: Date;
  updatedAt: Date;
}>();

function getUserId(request: { headers: { "x-user-id"?: string } }): string {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    const error = new Error("Unauthorized") as Error & { statusCode: number; code: string };
    error.statusCode = 401;
    error.code = ErrorCodes.UNAUTHORIZED;
    throw error;
  }
  return userId;
}

export const websiteRoutes: FastifyPluginAsync = async (fastify) => {
  // Create website project
  fastify.post("/websites", async (request, reply) => {
    const userId = getUserId(request);
    const input = CreateWebsiteSchema.parse(request.body);

    const id = createId();
    const now = new Date();

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
      files: new Map<string, { content: string; version: number }>(),
      createdAt: now,
      updatedAt: now,
    };

    // Initialize with template files
    initializeTemplate(website, input.framework, input.templateId);

    websites.set(id, website);

    logger.info({ websiteId: id, userId, framework: input.framework }, "Website created");

    return reply.status(201).send(successResponse({
      ...website,
      files: Array.from(website.files.entries()).map(([path, file]) => ({
        path,
        version: file.version,
      })),
    }, request.id));
  });

  // List websites
  fastify.get("/websites", async (request, reply) => {
    const userId = getUserId(request);

    const userWebsites = Array.from(websites.values())
      .filter(w => w.userId === userId)
      .map(w => ({
        ...w,
        files: undefined, // Don't include files in list
      }));

    return reply.send(successResponse(userWebsites, request.id));
  });

  // Get website
  fastify.get("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

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
        version: file.version,
      })),
    }, request.id));
  });

  // Update website
  fastify.put("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const input = UpdateWebsiteSchema.parse(request.body);

    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }

    if (input.name) website.name = input.name;
    if (input.description !== undefined) website.description = input.description;
    if (input.customDomain !== undefined) website.customDomain = input.customDomain;
    if (input.settings) website.settings = { ...website.settings, ...input.settings };
    website.updatedAt = new Date();

    return reply.send(successResponse(website, request.id));
  });

  // Delete website
  fastify.delete("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

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

  // AI Generate code
  fastify.post("/websites/:id/generate", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const input = GenerateCodeSchema.parse(request.body);

    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }

    // TODO: Call Agent Service for AI code generation
    // For now, return a placeholder response
    logger.info({ websiteId: id, prompt: input.prompt }, "Code generation requested");

    return reply.send(successResponse({
      status: "generating",
      message: "AI code generation in progress",
      // In production, this would stream updates via WebSocket
    }, request.id));
  });

  // Get file content
  fastify.get("/websites/:id/files/*", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const path = "/" + (request.params as { "*": string })["*"];

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
      version: file.version,
    }, request.id));
  });

  // Update file content
  fastify.put("/websites/:id/files/*", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const path = "/" + (request.params as { "*": string })["*"];
    const { content } = request.body as { content: string };

    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }

    const existing = website.files.get(path);
    website.files.set(path, {
      content,
      version: (existing?.version || 0) + 1,
    });
    website.updatedAt = new Date();

    logger.info({ websiteId: id, path }, "File updated");

    return reply.send(successResponse({
      path,
      version: website.files.get(path)!.version,
    }, request.id));
  });

  // List all files
  fastify.get("/websites/:id/files", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    const website = websites.get(id);
    if (!website || website.userId !== userId) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
      );
    }

    const files = Array.from(website.files.entries()).map(([path, file]) => ({
      path,
      version: file.version,
    }));

    return reply.send(successResponse(files, request.id));
  });
};

// Initialize template files
function initializeTemplate(
  website: { files: Map<string, { content: string; version: number }> },
  framework: string,
  templateId?: string
) {
  if (framework === "nextjs") {
    website.files.set("/package.json", {
      content: JSON.stringify({
        name: "my-app",
        version: "0.1.0",
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
        },
        dependencies: {
          next: "15.1.0",
          react: "19.0.0",
          "react-dom": "19.0.0",
        },
        devDependencies: {
          typescript: "^5.7.0",
          "@types/node": "^22.0.0",
          "@types/react": "^19.0.0",
        },
      }, null, 2),
      version: 1,
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
      version: 1,
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
      version: 1,
    });

    website.files.set("/app/globals.css", {
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      version: 1,
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
      version: 1,
    });
  }
}
