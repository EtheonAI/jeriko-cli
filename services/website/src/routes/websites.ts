import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createId,
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
} from "@repo/service-utils";
import { db, websites as websitesTable, websitePages, eq, and, desc } from "@repo/database";

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

function getUserId(request: { headers: Record<string, string | string[] | undefined> }): string {
  const userId = request.headers["x-user-id"] as string | undefined;
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

    try {
      const id = createId();

      const [website] = await db
        .insert(websitesTable)
        .values({
          id,
          userId,
          name: input.name,
          description: input.description || null,
          url: "",
          domain: "",
          status: "pending",
          metadata: { framework: input.framework, templateId: input.templateId },
        })
        .returning();

      // Initialize template pages as websitePages
      const templatePages = getTemplatePages(input.framework);
      for (const page of templatePages) {
        await db.insert(websitePages).values({
          id: createId(),
          websiteId: id,
          url: page.path,
          path: page.path,
          title: page.path,
          textContent: page.content,
          depth: 0,
        });
      }

      logger.info({ websiteId: id, userId, framework: input.framework }, "Website created");

      return reply.status(201).send(
        successResponse(
          {
            id: website!.id,
            userId: website!.userId,
            name: website!.name,
            description: website!.description,
            framework: input.framework,
            status: website!.status,
            files: templatePages.map((p) => ({ path: p.path, version: 1 })),
            createdAt: website!.createdAt,
            updatedAt: website!.updatedAt,
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to create website");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to create website" },
            request.id
          )
        );
    }
  });

  // List websites
  fastify.get("/websites", async (request, reply) => {
    const userId = getUserId(request);

    try {
      const userWebsites = await db
        .select()
        .from(websitesTable)
        .where(eq(websitesTable.userId, userId))
        .orderBy(desc(websitesTable.createdAt));

      return reply.send(successResponse(userWebsites, request.id));
    } catch (error) {
      logger.error(error, "Failed to list websites");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list websites" },
            request.id
          )
        );
    }
  });

  // Get website
  fastify.get("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const pages = await db
        .select({ path: websitePages.path })
        .from(websitePages)
        .where(eq(websitePages.websiteId, id));

      return reply.send(
        successResponse(
          {
            ...website,
            files: pages.map((p) => ({ path: p.path, version: 1 })),
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to get website");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get website" },
            request.id
          )
        );
    }
  });

  // Update website
  fastify.put("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const input = UpdateWebsiteSchema.parse(request.body);

    try {
      const [existing] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!existing) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const updateValues: Record<string, unknown> = {};
      if (input.name) updateValues.name = input.name;
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.settings)
        updateValues.config = { ...((existing.config as object) || {}), ...input.settings };

      const [updated] = await db
        .update(websitesTable)
        .set(updateValues as any)
        .where(eq(websitesTable.id, id))
        .returning();

      return reply.send(successResponse(updated, request.id));
    } catch (error) {
      logger.error(error, "Failed to update website");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to update website" },
            request.id
          )
        );
    }
  });

  // Delete website
  fastify.delete("/websites/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [deleted] = await db
        .delete(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .returning();

      if (!deleted) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      logger.info({ websiteId: id, userId }, "Website deleted");
      return reply.send(successResponse({ success: true }, request.id));
    } catch (error) {
      logger.error(error, "Failed to delete website");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to delete website" },
            request.id
          )
        );
    }
  });

  // AI Generate code
  fastify.post("/websites/:id/generate", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const input = GenerateCodeSchema.parse(request.body);

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      // TODO: Call Agent Service for AI code generation
      logger.info({ websiteId: id, prompt: input.prompt }, "Code generation requested");

      return reply.send(
        successResponse(
          {
            status: "generating",
            message: "AI code generation in progress",
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to generate code");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to generate code" },
            request.id
          )
        );
    }
  });

  // Get file content
  fastify.get("/websites/:id/files/*", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const path = "/" + (request.params as { "*": string })["*"];

    try {
      const [website] = await db
        .select({ id: websitesTable.id })
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const [page] = await db
        .select()
        .from(websitePages)
        .where(and(eq(websitePages.websiteId, id), eq(websitePages.path, path)))
        .limit(1);

      if (!page) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "File not found" }, request.id)
          );
      }

      return reply.send(
        successResponse(
          {
            path: page.path,
            content: page.textContent || "",
            version: 1,
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to get file");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get file" },
            request.id
          )
        );
    }
  });

  // Update file content
  fastify.put("/websites/:id/files/*", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const path = "/" + (request.params as { "*": string })["*"];
    const { content } = request.body as { content: string };

    try {
      const [website] = await db
        .select({ id: websitesTable.id })
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      // Upsert the page
      const [existing] = await db
        .select()
        .from(websitePages)
        .where(and(eq(websitePages.websiteId, id), eq(websitePages.path, path)))
        .limit(1);

      if (existing) {
        await db
          .update(websitePages)
          .set({ textContent: content })
          .where(eq(websitePages.id, existing.id));
      } else {
        await db.insert(websitePages).values({
          id: createId(),
          websiteId: id,
          url: path,
          path,
          title: path,
          textContent: content,
          depth: 0,
        });
      }

      logger.info({ websiteId: id, path }, "File updated");

      return reply.send(
        successResponse(
          {
            path,
            version: 1,
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to update file");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to update file" },
            request.id
          )
        );
    }
  });

  // List all files
  fastify.get("/websites/:id/files", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [website] = await db
        .select({ id: websitesTable.id })
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const pages = await db
        .select({ path: websitePages.path })
        .from(websitePages)
        .where(eq(websitePages.websiteId, id));

      const files = pages.map((p) => ({ path: p.path, version: 1 }));

      return reply.send(successResponse(files, request.id));
    } catch (error) {
      logger.error(error, "Failed to list files");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list files" },
            request.id
          )
        );
    }
  });
};

// Initialize template files
function getTemplatePages(framework: string): Array<{ path: string; content: string }> {
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
          },
          null,
          2
        ),
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
}`,
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
}`,
      },
      {
        path: "/app/globals.css",
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
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

export default config;`,
      },
    ];
  }
  return [];
}
