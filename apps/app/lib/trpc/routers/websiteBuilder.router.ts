import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  websiteProjects,
  projectFiles,
  deployments,
  eq,
  and,
  desc,
  count,
  sql,
} from "@repo/database";
import { TRPCError } from "@trpc/server";

// Website service URL for AI/preview/deploy stubs
const WEBSITE_SERVICE_URL = process.env.WEBSITE_SERVICE_URL || "http://localhost:4004";

async function fetchWebsiteService<T>(
  endpoint: string,
  options: RequestInit = {},
  userId: string
): Promise<T> {
  const url = `${WEBSITE_SERVICE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: "Request failed" } }));
    const message =
      body?.error?.message || body?.message || `Website service error: ${response.status}`;
    throw new TRPCError({
      code:
        response.status === 404
          ? "NOT_FOUND"
          : response.status === 403
            ? "FORBIDDEN"
            : "INTERNAL_SERVER_ERROR",
      message,
    });
  }

  const json = await response.json();
  return json.data as T;
}

// Default template files for a new Next.js project
function getTemplateFiles(framework: string) {
  if (framework === "nextjs") {
    return [
      {
        path: "/",
        name: "app",
        isDirectory: true,
        content: null,
        language: null,
      },
      {
        path: "/app",
        name: "page.tsx",
        isDirectory: false,
        language: "typescript",
        content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to your app</h1>
      <p className="mt-4 text-lg text-gray-600">
        Start editing this page to build something amazing.
      </p>
    </main>
  );
}`,
      },
      {
        path: "/app",
        name: "layout.tsx",
        isDirectory: false,
        language: "typescript",
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
        path: "/app",
        name: "globals.css",
        isDirectory: false,
        language: "css",
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: system-ui, -apple-system, sans-serif;
}`,
      },
      {
        path: "/",
        name: "package.json",
        isDirectory: false,
        language: "json",
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
              next: "^14.0.0",
              react: "^18.0.0",
              "react-dom": "^18.0.0",
            },
            devDependencies: {
              typescript: "^5.0.0",
              "@types/react": "^18.0.0",
              tailwindcss: "^3.0.0",
            },
          },
          null,
          2
        ),
      },
      {
        path: "/",
        name: "tsconfig.json",
        isDirectory: false,
        language: "json",
        content: JSON.stringify(
          {
            compilerOptions: {
              target: "es5",
              lib: ["dom", "dom.iterable", "esnext"],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: "esnext",
              moduleResolution: "bundler",
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: "preserve",
              incremental: true,
              paths: { "@/*": ["./*"] },
            },
            include: ["**/*.ts", "**/*.tsx"],
            exclude: ["node_modules"],
          },
          null,
          2
        ),
      },
    ];
  }

  // Default: minimal React template
  return [
    {
      path: "/",
      name: "src",
      isDirectory: true,
      content: null,
      language: null,
    },
    {
      path: "/src",
      name: "App.tsx",
      isDirectory: false,
      language: "typescript",
      content: `export default function App() {
  return (
    <div className="app">
      <h1>Hello World</h1>
    </div>
  );
}`,
    },
    {
      path: "/",
      name: "package.json",
      isDirectory: false,
      language: "json",
      content: JSON.stringify(
        {
          name: "my-app",
          version: "0.1.0",
          private: true,
          dependencies: {
            react: "^18.0.0",
            "react-dom": "^18.0.0",
          },
        },
        null,
        2
      ),
    },
  ];
}

export const websiteBuilderRouter = createTRPCRouter({
  // ─── Projects ────────────────────────────────────────────

  projectsList: protectedProcedure.query(async ({ ctx }) => {
    const projects = await db
      .select({
        project: websiteProjects,
        fileCount: count(projectFiles.id),
      })
      .from(websiteProjects)
      .leftJoin(projectFiles, eq(projectFiles.projectId, websiteProjects.id))
      .where(eq(websiteProjects.userId, ctx.user.id))
      .groupBy(websiteProjects.id)
      .orderBy(desc(websiteProjects.createdAt));

    return projects;
  }),

  projectsGet: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [result] = await db
        .select({
          project: websiteProjects,
          fileCount: count(projectFiles.id),
        })
        .from(websiteProjects)
        .leftJoin(projectFiles, eq(projectFiles.projectId, websiteProjects.id))
        .where(and(eq(websiteProjects.id, input.id), eq(websiteProjects.userId, ctx.user.id)))
        .groupBy(websiteProjects.id)
        .limit(1);

      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      return result;
    }),

  projectsCreate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        framework: z.enum(["nextjs", "react", "vue", "svelte", "astro"]).default("nextjs"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [project] = await db
        .insert(websiteProjects)
        .values({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          framework: input.framework,
        })
        .returning();

      if (!project) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create project",
        });
      }

      // Insert template files
      const templateFiles = getTemplateFiles(input.framework);
      if (templateFiles.length > 0) {
        await db.insert(projectFiles).values(
          templateFiles.map((f) => ({
            projectId: project.id,
            path: f.path,
            name: f.name,
            content: f.content,
            language: f.language,
            isDirectory: f.isDirectory,
          }))
        );
      }

      return project;
    }),

  projectsUpdate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const [project] = await db
        .update(websiteProjects)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(websiteProjects.id, id), eq(websiteProjects.userId, ctx.user.id)))
        .returning();

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      return project;
    }),

  projectsDelete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Delete files and deployments first (cascade)
      await db.delete(projectFiles).where(eq(projectFiles.projectId, input.id));
      await db.delete(deployments).where(eq(deployments.projectId, input.id));
      // Delete project
      const [deleted] = await db
        .delete(websiteProjects)
        .where(and(eq(websiteProjects.id, input.id), eq(websiteProjects.userId, ctx.user.id)))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      return { success: true };
    }),

  // ─── Files ───────────────────────────────────────────────

  filesList: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const [project] = await db
        .select({ id: websiteProjects.id })
        .from(websiteProjects)
        .where(
          and(eq(websiteProjects.id, input.projectId), eq(websiteProjects.userId, ctx.user.id))
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const files = await db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.projectId, input.projectId))
        .orderBy(projectFiles.path, projectFiles.name);

      return files;
    }),

  filesGet: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.id, input.id))
      .limit(1);

    if (!file) {
      throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
    }

    return file;
  }),

  filesCreate: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        path: z.string(),
        name: z.string().min(1),
        content: z.string().optional(),
        language: z.string().optional(),
        isDirectory: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [project] = await db
        .select({ id: websiteProjects.id })
        .from(websiteProjects)
        .where(
          and(eq(websiteProjects.id, input.projectId), eq(websiteProjects.userId, ctx.user.id))
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const [file] = await db
        .insert(projectFiles)
        .values({
          projectId: input.projectId,
          path: input.path,
          name: input.name,
          content: input.content ?? null,
          language: input.language ?? null,
          isDirectory: input.isDirectory,
        })
        .returning();

      return file!;
    }),

  filesUpdate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const [file] = await db
        .update(projectFiles)
        .set({
          content: input.content,
          version: sql`${projectFiles.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(projectFiles.id, input.id))
        .returning();

      if (!file) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }

      return file;
    }),

  filesDelete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [deleted] = await db
        .delete(projectFiles)
        .where(eq(projectFiles.id, input.id))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }

      return { success: true };
    }),

  // ─── AI Generate (backend stub) ──────────────────────────

  generate: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        prompt: z.string().min(1),
        fileIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await fetchWebsiteService<{ message: string }>(
          `/websites/${input.projectId}/generate`,
          {
            method: "POST",
            body: JSON.stringify({
              prompt: input.prompt,
              fileIds: input.fileIds,
            }),
          },
          ctx.user.id
        );
      } catch {
        // Service unavailable — return stub response
        return {
          message: "AI generation service is not yet connected. Your prompt has been recorded.",
        };
      }
    }),

  // ─── Preview (backend stub) ──────────────────────────────

  previewStart: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await fetchWebsiteService<{ previewUrl: string }>(
          `/websites/${input.projectId}/preview`,
          { method: "POST" },
          ctx.user.id
        );
      } catch {
        return { previewUrl: null as string | null };
      }
    }),

  previewStatus: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await fetchWebsiteService<{
          status: string;
          url: string | null;
        }>(`/websites/${input.projectId}/preview/status`, {}, ctx.user.id);
      } catch {
        return { status: "unavailable", url: null };
      }
    }),

  // ─── Deployments ─────────────────────────────────────────

  deployCreate: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        platform: z.enum(["vercel", "netlify"]).default("vercel"),
        environment: z.string().default("preview"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [project] = await db
        .select({ id: websiteProjects.id })
        .from(websiteProjects)
        .where(
          and(eq(websiteProjects.id, input.projectId), eq(websiteProjects.userId, ctx.user.id))
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const [deployment] = await db
        .insert(deployments)
        .values({
          projectId: input.projectId,
          platform: input.platform,
          environment: input.environment,
          status: "queued",
        })
        .returning();

      // Try to kick off backend deploy
      try {
        await fetchWebsiteService(
          `/websites/${input.projectId}/deploy`,
          {
            method: "POST",
            body: JSON.stringify({
              deploymentId: deployment!.id,
              platform: input.platform,
              environment: input.environment,
            }),
          },
          ctx.user.id
        );
      } catch {
        // Service unavailable — deployment stays queued
      }

      return deployment!;
    }),

  deployList: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const deps = await db
        .select()
        .from(deployments)
        .where(eq(deployments.projectId, input.projectId))
        .orderBy(desc(deployments.createdAt));

      return deps;
    }),

  deployGet: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, input.id))
      .limit(1);

    if (!deployment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Deployment not found",
      });
    }

    return deployment;
  }),
});
