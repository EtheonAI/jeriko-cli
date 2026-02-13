import type { FastifyInstance } from "fastify";

const SANDBOX_SERVICE_URL =
  process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

async function sandboxExec(
  sandboxId: string,
  command: string,
  userId: string,
  timeout = 30000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/shell`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ command, timeout }),
      signal: AbortSignal.timeout(timeout + 5000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Sandbox exec failed: ${resp.status} ${detail}`);
  }
  const data = (await resp.json()) as {
    data?: { stdout?: string; stderr?: string; exitCode?: number };
  };
  return {
    stdout: data.data?.stdout || "",
    stderr: data.data?.stderr || "",
    exitCode: data.data?.exitCode ?? 1,
  };
}

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  // Sync skills from system registry to user's sandbox
  app.post("/api/skills/sync", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      registry?: string;
    };

    const { sandboxId, userId } = body;
    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      // Ensure the user skills directory exists
      await sandboxExec(
        sandboxId,
        `mkdir -p /home/user/skills`,
        userId,
        5000,
      );

      // Copy baked-in skills from system path to user path
      const copyResult = await sandboxExec(
        sandboxId,
        `cp -r /opt/.rubic/skills/* /home/user/skills/ 2>/dev/null || true`,
        userId,
        10000,
      );

      if (copyResult.exitCode !== 0 && copyResult.stderr) {
        request.log.warn(
          { stderr: copyResult.stderr },
          "Warning during skill sync copy",
        );
      }

      // If a custom registry URL is provided, pull from it
      if (body.registry) {
        const registryUrl = body.registry;
        // Support git repos as skill registries
        if (
          registryUrl.endsWith(".git") ||
          registryUrl.startsWith("https://github.com")
        ) {
          await sandboxExec(
            sandboxId,
            `cd /tmp && git clone --depth 1 "${registryUrl}" _skill_registry 2>/dev/null && cp -r /tmp/_skill_registry/* /home/user/skills/ && rm -rf /tmp/_skill_registry`,
            userId,
            30000,
          );
        } else {
          // Assume JSON registry — download and parse
          await sandboxExec(
            sandboxId,
            `curl -sL "${registryUrl}" -o /tmp/skills-registry.json`,
            userId,
            15000,
          );
        }
      }

      // List available skills after sync
      const listResult = await sandboxExec(
        sandboxId,
        `ls -1 /home/user/skills/`,
        userId,
        5000,
      );

      const skills = listResult.stdout
        .trim()
        .split("\n")
        .filter(Boolean);

      return reply.send({ success: true, skills, count: skills.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Failed to sync skills");
      return reply.status(500).send({ error: message });
    }
  });

  // Package a skill for distribution
  app.post("/api/skills/package", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      skillName: string;
      skillPath?: string;
    };

    const { sandboxId, userId, skillName } = body;
    if (!sandboxId || !userId || !skillName) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and skillName required" });
    }

    try {
      const skillDir =
        body.skillPath || `/home/user/skills/${skillName}`;

      // Verify the skill directory exists
      const checkResult = await sandboxExec(
        sandboxId,
        `test -d "${skillDir}" && echo "exists" || echo "missing"`,
        userId,
        5000,
      );

      if (checkResult.stdout.trim() !== "exists") {
        return reply
          .status(404)
          .send({ error: `Skill directory not found: ${skillDir}` });
      }

      // Clean up any previous zip
      await sandboxExec(
        sandboxId,
        `rm -f /tmp/${skillName}.zip`,
        userId,
        5000,
      );

      // Zip the skill directory
      const zipResult = await sandboxExec(
        sandboxId,
        `cd "${skillDir}" && zip -r /tmp/${skillName}.zip .`,
        userId,
        15000,
      );

      if (zipResult.exitCode !== 0) {
        return reply.status(500).send({
          error: `Failed to zip skill: ${zipResult.stderr}`,
        });
      }

      // Upload to S3 via rubic-upload-file
      const uploadResult = await sandboxExec(
        sandboxId,
        `rubic-upload-file /tmp/${skillName}.zip`,
        userId,
        30000,
      );

      if (uploadResult.exitCode !== 0) {
        return reply.status(500).send({
          error: `Failed to upload skill: ${uploadResult.stderr}`,
        });
      }

      // Clean up temp zip
      await sandboxExec(
        sandboxId,
        `rm -f /tmp/${skillName}.zip`,
        userId,
        5000,
      );

      return reply.send({
        success: true,
        url: uploadResult.stdout.trim(),
        skillName,
        skillDir,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Failed to package skill");
      return reply.status(500).send({ error: message });
    }
  });
}
