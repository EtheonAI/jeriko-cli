import Fastify from "fastify";
import { Sandbox as E2BSandbox } from "@e2b/code-interpreter";
import { createLogger, getEnv, createId } from "@repo/service-utils";
import { db, sandboxes, sandboxExecutions, sandboxFiles, eq, and, desc } from "@repo/database";

const logger = createLogger({ service: "sandbox" });

// In-memory map of active E2B sandbox instances keyed by our DB sandbox ID
const sandboxMap = new Map<string, E2BSandbox>();

const E2B_API_KEY = getEnv("E2B_API_KEY", "");

/**
 * Get or reconnect to an E2B sandbox instance.
 * Looks up our in-memory map first, then attempts to reconnect using the stored e2bSandboxId.
 */
async function getE2BSandbox(dbSandboxId: string): Promise<E2BSandbox> {
  const cached = sandboxMap.get(dbSandboxId);
  if (cached) {
    return cached;
  }

  // Look up the e2bSandboxId from the DB
  const [record] = await db
    .select({ e2bSandboxId: sandboxes.e2bSandboxId, status: sandboxes.status })
    .from(sandboxes)
    .where(eq(sandboxes.id, dbSandboxId))
    .limit(1);

  if (!record) {
    throw new Error(`Sandbox ${dbSandboxId} not found in database`);
  }

  if (!record.e2bSandboxId) {
    throw new Error(`Sandbox ${dbSandboxId} has no E2B sandbox ID`);
  }

  if (record.status === "stopped" || record.status === "terminated") {
    throw new Error(`Sandbox ${dbSandboxId} is ${record.status}`);
  }

  // Reconnect to the E2B sandbox
  const e2bSandbox = await E2BSandbox.connect(record.e2bSandboxId, {
    apiKey: E2B_API_KEY,
  });

  sandboxMap.set(dbSandboxId, e2bSandbox);
  return e2bSandbox;
}

async function main() {
  const port = parseInt(getEnv("PORT", "4012"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  if (!E2B_API_KEY) {
    logger.warn("E2B_API_KEY not set — sandbox creation will fail");
  }

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "sandbox" };
  });

  // Create sandbox
  app.post("/sandboxes", async (request, reply) => {
    const { userId, projectId, template, config } = request.body as {
      userId: string;
      projectId?: string;
      template?: string;
      config?: {
        timeout?: number;
        memory?: number;
        env?: Record<string, string>;
      };
    };

    if (!E2B_API_KEY) {
      return reply.status(503).send({ error: "E2B_API_KEY not configured" });
    }

    try {
      const timeoutMs = config?.timeout || 300_000; // 5 minutes default

      // Create E2B sandbox
      const e2bSandbox = await E2BSandbox.create({
        apiKey: E2B_API_KEY,
        timeoutMs,
        envs: config?.env,
      });

      const dbId = createId();

      // Store in DB
      const [sandbox] = await db
        .insert(sandboxes)
        .values({
          id: dbId,
          userId,
          projectId,
          name: `sandbox-${Date.now()}`,
          type: "code",
          status: "running",
          templateId: template,
          config: config || {},
          e2bSandboxId: e2bSandbox.sandboxId,
          hostname: e2bSandbox.getHost(80),
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + timeoutMs),
        })
        .returning();

      // Cache the instance
      sandboxMap.set(dbId, e2bSandbox);

      logger.info(
        { sandboxId: dbId, e2bSandboxId: e2bSandbox.sandboxId, userId, template },
        "Sandbox created"
      );

      return {
        id: sandbox!.id,
        status: "running",
        e2bSandboxId: e2bSandbox.sandboxId,
        hostname: e2bSandbox.getHost(80),
        template: template || "default",
      };
    } catch (error) {
      logger.error(error, "Failed to create sandbox");
      const message = error instanceof Error ? error.message : "Failed to create sandbox";
      return reply.status(502).send({ error: message });
    }
  });

  // Get sandbox
  app.get("/sandboxes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [sandbox] = await db.select().from(sandboxes).where(eq(sandboxes.id, id)).limit(1);
      if (!sandbox) {
        return reply.status(404).send({ error: "Sandbox not found" });
      }
      return sandbox;
    } catch (error) {
      logger.error(error, "Failed to fetch sandbox");
      return reply.status(500).send({ error: "Failed to fetch sandbox" });
    }
  });

  // List user sandboxes
  app.get("/users/:userId/sandboxes", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    try {
      const results = await db
        .select()
        .from(sandboxes)
        .where(eq(sandboxes.userId, userId))
        .orderBy(desc(sandboxes.createdAt));
      return { sandboxes: results };
    } catch (error) {
      logger.error(error, "Failed to list sandboxes");
      return reply.status(500).send({ error: "Failed to list sandboxes" });
    }
  });

  // Execute code in sandbox (synchronous — waits for result)
  app.post("/sandboxes/:id/execute", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { code, language, timeout } = request.body as {
      code: string;
      language?: string;
      timeout?: number;
    };

    const execId = createId();
    const timeoutMs = timeout || 30_000;
    const startedAt = new Date();

    try {
      // Insert execution record
      await db.insert(sandboxExecutions).values({
        id: execId,
        sandboxId: id,
        type: "code",
        language: language || "python",
        code,
        status: "running",
        timeoutMs,
        startedAt,
      });

      // Get E2B sandbox instance
      let e2bSandbox: E2BSandbox;
      try {
        e2bSandbox = await getE2BSandbox(id);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Sandbox unavailable";
        await db
          .update(sandboxExecutions)
          .set({ status: "failed", error: errorMsg, completedAt: new Date() })
          .where(eq(sandboxExecutions.id, execId));
        return reply.status(410).send({ error: errorMsg });
      }

      // Run code in E2B
      const execution = await e2bSandbox.runCode(code, {
        language: language || "python",
        timeoutMs,
      });

      const completedAt = new Date();
      const executionTimeMs = completedAt.getTime() - startedAt.getTime();
      const stdout = execution.logs.stdout.join("\n");
      const stderr = execution.logs.stderr.join("\n");
      const hasError = !!execution.error;
      const status = hasError ? "failed" : "completed";

      // Update execution record
      await db
        .update(sandboxExecutions)
        .set({
          status,
          stdout,
          stderr,
          exitCode: hasError ? 1 : 0,
          result: execution.toJSON(),
          error: execution.error ? `${execution.error.name}: ${execution.error.value}` : null,
          completedAt,
          executionTimeMs,
        })
        .where(eq(sandboxExecutions.id, execId));

      // Update sandbox last activity
      await db.update(sandboxes).set({ lastActivityAt: completedAt }).where(eq(sandboxes.id, id));

      logger.info(
        { sandboxId: id, executionId: execId, language, status, executionTimeMs },
        "Execution completed"
      );

      return {
        id: execId,
        status,
        stdout,
        stderr,
        exitCode: hasError ? 1 : 0,
        error: execution.error
          ? {
              name: execution.error.name,
              value: execution.error.value,
              traceback: execution.error.traceback,
            }
          : null,
        results: execution.results.map((r) => r.toJSON()),
        text: execution.text,
        executionTimeMs,
      };
    } catch (error) {
      const completedAt = new Date();
      const executionTimeMs = completedAt.getTime() - startedAt.getTime();
      const errorMsg = error instanceof Error ? error.message : "Execution failed";

      // Check if it's a timeout
      const isTimeout = error instanceof Error && error.message.toLowerCase().includes("timeout");

      await db
        .update(sandboxExecutions)
        .set({
          status: isTimeout ? "timeout" : "failed",
          error: errorMsg,
          completedAt,
          executionTimeMs,
        })
        .where(eq(sandboxExecutions.id, execId));

      logger.error(error, "Failed to execute code");

      if (isTimeout) {
        return reply.status(408).send({
          id: execId,
          status: "timeout",
          error: errorMsg,
          executionTimeMs,
        });
      }

      return reply.status(502).send({ error: errorMsg });
    }
  });

  // Get execution result
  app.get("/executions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [execution] = await db
        .select()
        .from(sandboxExecutions)
        .where(eq(sandboxExecutions.id, id))
        .limit(1);
      if (!execution) {
        return reply.status(404).send({ error: "Execution not found" });
      }
      return {
        id: execution.id,
        status: execution.status,
        stdout: execution.stdout || "",
        stderr: execution.stderr || "",
        exitCode: execution.exitCode ?? 0,
        error: execution.error || null,
        result: execution.result || null,
        executionTimeMs: execution.executionTimeMs || null,
      };
    } catch (error) {
      logger.error(error, "Failed to fetch execution");
      return reply.status(500).send({ error: "Failed to fetch execution" });
    }
  });

  // Run shell command in sandbox (synchronous)
  app.post("/sandboxes/:id/shell", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { command, timeout } = request.body as {
      command: string;
      timeout?: number;
    };

    const execId = createId();
    const timeoutMs = timeout || 30_000;
    const startedAt = new Date();

    try {
      await db.insert(sandboxExecutions).values({
        id: execId,
        sandboxId: id,
        type: "command",
        code: command,
        status: "running",
        timeoutMs,
        startedAt,
      });

      // Get E2B sandbox instance
      let e2bSandbox: E2BSandbox;
      try {
        e2bSandbox = await getE2BSandbox(id);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Sandbox unavailable";
        await db
          .update(sandboxExecutions)
          .set({ status: "failed", error: errorMsg, completedAt: new Date() })
          .where(eq(sandboxExecutions.id, execId));
        return reply.status(410).send({ error: errorMsg });
      }

      // Run shell command
      const result = await e2bSandbox.commands.run(command, { timeoutMs });

      const completedAt = new Date();
      const executionTimeMs = completedAt.getTime() - startedAt.getTime();
      const status = result.exitCode === 0 ? "completed" : "failed";

      await db
        .update(sandboxExecutions)
        .set({
          status,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          completedAt,
          executionTimeMs,
        })
        .where(eq(sandboxExecutions.id, execId));

      await db.update(sandboxes).set({ lastActivityAt: completedAt }).where(eq(sandboxes.id, id));

      logger.info(
        { sandboxId: id, executionId: execId, exitCode: result.exitCode },
        "Shell command completed"
      );

      return {
        id: execId,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs,
      };
    } catch (error) {
      const completedAt = new Date();
      const executionTimeMs = completedAt.getTime() - startedAt.getTime();
      const errorMsg = error instanceof Error ? error.message : "Command failed";

      await db
        .update(sandboxExecutions)
        .set({
          status: "failed",
          error: errorMsg,
          completedAt,
          executionTimeMs,
        })
        .where(eq(sandboxExecutions.id, execId));

      logger.error(error, "Failed to run shell command");
      return reply.status(502).send({ error: errorMsg });
    }
  });

  // Write file to sandbox
  app.post("/sandboxes/:id/files", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path, content } = request.body as {
      path: string;
      content: string;
    };

    try {
      // Get E2B sandbox and write file
      let e2bSandbox: E2BSandbox;
      try {
        e2bSandbox = await getE2BSandbox(id);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Sandbox unavailable";
        return reply.status(410).send({ error: errorMsg });
      }

      await e2bSandbox.files.write(path, content);

      // Track in DB
      const fileName = path.split("/").pop() || path;
      await db.insert(sandboxFiles).values({
        id: createId(),
        sandboxId: id,
        path,
        name: fileName,
        content,
        size: Buffer.byteLength(content, "utf-8"),
      });

      logger.info({ sandboxId: id, path }, "File written");
      return { path, written: true };
    } catch (error) {
      logger.error(error, "Failed to upload file");
      const message = error instanceof Error ? error.message : "Failed to upload file";
      return reply.status(502).send({ error: message });
    }
  });

  // Read file from sandbox
  app.get("/sandboxes/:id/files", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path } = request.query as { path: string };

    try {
      // Read directly from E2B sandbox
      let e2bSandbox: E2BSandbox;
      try {
        e2bSandbox = await getE2BSandbox(id);
      } catch (err) {
        // Fall back to DB if sandbox is unavailable
        const [file] = await db
          .select()
          .from(sandboxFiles)
          .where(and(eq(sandboxFiles.sandboxId, id), eq(sandboxFiles.path, path)))
          .limit(1);

        if (!file) {
          return reply.status(404).send({ error: "File not found" });
        }
        return { path: file.path, content: file.content || "" };
      }

      const content = await e2bSandbox.files.read(path, { format: "text" });
      return { path, content };
    } catch (error) {
      logger.error(error, "Failed to read file");
      const message = error instanceof Error ? error.message : "Failed to read file";
      return reply.status(502).send({ error: message });
    }
  });

  // List files in sandbox
  app.get("/sandboxes/:id/files/list", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path } = request.query as { path?: string };

    try {
      let e2bSandbox: E2BSandbox;
      try {
        e2bSandbox = await getE2BSandbox(id);
      } catch (err) {
        // Fall back to DB listing
        const conditions = [eq(sandboxFiles.sandboxId, id)];
        if (path) {
          conditions.push(eq(sandboxFiles.path, path));
        }
        const filesList = await db
          .select({
            path: sandboxFiles.path,
            name: sandboxFiles.name,
            isDirectory: sandboxFiles.isDirectory,
            size: sandboxFiles.size,
          })
          .from(sandboxFiles)
          .where(and(...conditions));

        return { files: filesList };
      }

      const dirPath = path || "/home/user";
      const entries = await e2bSandbox.files.list(dirPath);

      return {
        files: entries.map((entry) => ({
          name: entry.name,
          path: entry.path,
          type: entry.type,
          size: entry.size,
        })),
      };
    } catch (error) {
      logger.error(error, "Failed to list files");
      const message = error instanceof Error ? error.message : "Failed to list files";
      return reply.status(502).send({ error: message });
    }
  });

  // Stop sandbox
  app.post("/sandboxes/:id/stop", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      // Kill E2B sandbox if available
      const cached = sandboxMap.get(id);
      if (cached) {
        try {
          await cached.kill();
        } catch (err) {
          logger.warn(
            { sandboxId: id, error: err },
            "Failed to kill E2B sandbox (may already be stopped)"
          );
        }
        sandboxMap.delete(id);
      } else {
        // Try to kill via stored e2bSandboxId
        const [record] = await db
          .select({ e2bSandboxId: sandboxes.e2bSandboxId })
          .from(sandboxes)
          .where(eq(sandboxes.id, id))
          .limit(1);

        if (record?.e2bSandboxId) {
          try {
            const e2b = await E2BSandbox.connect(record.e2bSandboxId, {
              apiKey: E2B_API_KEY,
            });
            await e2b.kill();
          } catch (err) {
            logger.warn({ sandboxId: id, error: err }, "Failed to kill E2B sandbox on stop");
          }
        }
      }

      const [updated] = await db
        .update(sandboxes)
        .set({ status: "stopped" })
        .where(eq(sandboxes.id, id))
        .returning();
      if (!updated) {
        return reply.status(404).send({ error: "Sandbox not found" });
      }
      logger.info({ sandboxId: id }, "Sandbox stopped");
      return { id, status: "stopped" };
    } catch (error) {
      logger.error(error, "Failed to stop sandbox");
      return reply.status(500).send({ error: "Failed to stop sandbox" });
    }
  });

  // Delete sandbox
  app.delete("/sandboxes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      // Kill E2B sandbox if available
      const cached = sandboxMap.get(id);
      if (cached) {
        try {
          await cached.kill();
        } catch (err) {
          logger.warn({ sandboxId: id, error: err }, "Failed to kill E2B sandbox on delete");
        }
        sandboxMap.delete(id);
      } else {
        const [record] = await db
          .select({ e2bSandboxId: sandboxes.e2bSandboxId })
          .from(sandboxes)
          .where(eq(sandboxes.id, id))
          .limit(1);

        if (record?.e2bSandboxId) {
          try {
            const e2b = await E2BSandbox.connect(record.e2bSandboxId, {
              apiKey: E2B_API_KEY,
            });
            await e2b.kill();
          } catch (err) {
            logger.warn({ sandboxId: id, error: err }, "Failed to kill E2B sandbox on delete");
          }
        }
      }

      const [deleted] = await db.delete(sandboxes).where(eq(sandboxes.id, id)).returning();
      if (!deleted) {
        return reply.status(404).send({ error: "Sandbox not found" });
      }
      return { deleted: true };
    } catch (error) {
      logger.error(error, "Failed to delete sandbox");
      return reply.status(500).send({ error: "Failed to delete sandbox" });
    }
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
  });

  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Sandbox service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  // Graceful shutdown — kill all active E2B sandboxes
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal, activeSandboxes: sandboxMap.size }, "Received shutdown signal");

      // Kill all active E2B sandboxes
      const killPromises = Array.from(sandboxMap.entries()).map(async ([dbId, e2bSandbox]) => {
        try {
          await e2bSandbox.kill();
          logger.info({ sandboxId: dbId }, "Killed E2B sandbox on shutdown");
        } catch (err) {
          logger.warn({ sandboxId: dbId, error: err }, "Failed to kill E2B sandbox on shutdown");
        }
      });
      await Promise.allSettled(killPromises);
      sandboxMap.clear();

      await app.close();
      process.exit(0);
    });
  }
}

main();
