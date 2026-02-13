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

async function sandboxWriteFile(
  sandboxId: string,
  filePath: string,
  content: string,
  userId: string,
): Promise<void> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ path: filePath, content }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`File write failed: ${resp.status} ${detail}`);
  }
}

async function sandboxReadFile(
  sandboxId: string,
  filePath: string,
  userId: string,
): Promise<string> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files?path=${encodeURIComponent(filePath)}`,
    {
      headers: { "x-user-id": userId },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`File read failed: ${resp.status} ${detail}`);
  }
  const data = (await resp.json()) as { data?: { content?: string } };
  return data.data?.content || "";
}

const DEFAULT_INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rubic Slides</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="slide-container"></div>
  <div id="controls">
    <button id="prev" onclick="navigate(-1)">&#8592;</button>
    <span id="slide-counter"></span>
    <button id="next" onclick="navigate(1)">&#8594;</button>
  </div>
  <script>
    let currentSlide = 0;
    let slides = [];
    const params = new URLSearchParams(window.location.search);
    const isPresent = params.get('mode') === 'present';

    async function loadSlides() {
      const resp = await fetch('./slides.json');
      slides = await resp.json();
      slides.sort((a, b) => a.order - b.order);
      render();
    }

    function render() {
      if (!slides.length) return;
      const s = slides[currentSlide];
      const container = document.getElementById('slide-container');
      container.innerHTML = '<h1>' + s.title + '</h1><div class="content">' + s.content + '</div>';
      if (s.background) container.style.background = s.background;
      document.getElementById('slide-counter').textContent = (currentSlide + 1) + ' / ' + slides.length;
      if (isPresent) document.getElementById('controls').classList.add('present-mode');
    }

    function navigate(dir) {
      currentSlide = Math.max(0, Math.min(slides.length - 1, currentSlide + dir));
      render();
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === ' ') navigate(1);
      if (e.key === 'ArrowLeft') navigate(-1);
    });

    loadSlides();
  </script>
</body>
</html>`;

const DEFAULT_STYLE_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; background: #1a1a2e; color: #eee; }
#slide-container {
  width: 100vw; height: 100vh; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 2rem;
}
#slide-container h1 { font-size: 3rem; margin-bottom: 1.5rem; }
#slide-container .content { font-size: 1.5rem; max-width: 80%; line-height: 1.6; }
#controls {
  position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 1rem; background: rgba(0,0,0,0.5);
  padding: 0.5rem 1.5rem; border-radius: 2rem;
}
#controls button {
  background: none; border: none; color: #eee; font-size: 1.5rem; cursor: pointer;
  padding: 0.25rem 0.75rem; border-radius: 0.5rem;
}
#controls button:hover { background: rgba(255,255,255,0.1); }
#slide-counter { font-size: 0.9rem; opacity: 0.7; }
#controls.present-mode { opacity: 0; transition: opacity 0.3s; }
#controls.present-mode:hover { opacity: 1; }
`;

const DEFAULT_SLIDES_JSON = JSON.stringify(
  [
    {
      id: "slide-1",
      title: "Welcome",
      content: "Your presentation starts here.",
      notes: "",
      background: "",
      order: 0,
    },
  ],
  null,
  2,
);

interface SlideData {
  id: string;
  title: string;
  content: string;
  notes: string;
  background: string;
  order: number;
}

export async function slideRoutes(app: FastifyInstance): Promise<void> {
  // Initialize a new slide project
  app.post("/api/slides/init-project", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      appName?: string;
      projectPath?: string;
    };

    const { sandboxId, userId } = body;
    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      const appName = body.appName || "slides-project";
      const projectPath =
        body.projectPath || `/home/user/${appName}`;

      // Create project directory structure
      await sandboxExec(
        sandboxId,
        `mkdir -p "${projectPath}/slides" "${projectPath}/assets"`,
        userId,
        10000,
      );

      // Write template files
      await sandboxWriteFile(
        sandboxId,
        `${projectPath}/slides/index.html`,
        DEFAULT_INDEX_HTML,
        userId,
      );
      await sandboxWriteFile(
        sandboxId,
        `${projectPath}/slides/style.css`,
        DEFAULT_STYLE_CSS,
        userId,
      );
      await sandboxWriteFile(
        sandboxId,
        `${projectPath}/slides/slides.json`,
        DEFAULT_SLIDES_JSON,
        userId,
      );

      // Start a simple dev server on port 3000
      await sandboxExec(
        sandboxId,
        `cd "${projectPath}/slides" && nohup python3 -m http.server 3000 > /tmp/slides-server.log 2>&1 &`,
        userId,
        10000,
      );

      // Derive preview URL from sandbox ID
      const previewUrl = `https://3000-${sandboxId}.e2b.dev`;

      return reply.send({
        success: true,
        projectPath,
        previewUrl,
        slides: JSON.parse(DEFAULT_SLIDES_JSON),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Failed to initialize slide project");
      return reply.status(500).send({ error: message });
    }
  });

  // Modify a specific slide
  app.post("/api/slides/modify", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      slideId: string;
      projectPath?: string;
      changes: {
        title?: string;
        content?: string;
        background?: string;
        order?: number;
      };
    };

    const { sandboxId, userId, slideId, changes } = body;
    if (!sandboxId || !userId || !slideId) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and slideId required" });
    }

    try {
      const projectPath =
        body.projectPath || "/home/user/slides-project";
      const slidesJsonPath = `${projectPath}/slides/slides.json`;

      const raw = await sandboxReadFile(sandboxId, slidesJsonPath, userId);
      const slides: SlideData[] = JSON.parse(raw);

      const slideIndex = slides.findIndex((s) => s.id === slideId);
      if (slideIndex === -1) {
        return reply
          .status(404)
          .send({ error: `Slide "${slideId}" not found` });
      }

      const slide = slides[slideIndex]!;
      if (changes.title !== undefined) slide.title = changes.title;
      if (changes.content !== undefined) slide.content = changes.content;
      if (changes.background !== undefined) slide.background = changes.background;
      if (changes.order !== undefined) slide.order = changes.order;

      await sandboxWriteFile(
        sandboxId,
        slidesJsonPath,
        JSON.stringify(slides, null, 2),
        userId,
      );

      return reply.send({ success: true, slide: slides[slideIndex] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Failed to modify slide");
      return reply.status(500).send({ error: message });
    }
  });

  // Add or update slide notes
  app.post("/api/slides/notes", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      slideId: string;
      notes: string;
      projectPath?: string;
    };

    const { sandboxId, userId, slideId, notes } = body;
    if (!sandboxId || !userId || !slideId) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and slideId required" });
    }

    try {
      const projectPath =
        body.projectPath || "/home/user/slides-project";
      const slidesJsonPath = `${projectPath}/slides/slides.json`;

      const raw = await sandboxReadFile(sandboxId, slidesJsonPath, userId);
      const slides: SlideData[] = JSON.parse(raw);

      const slideIndex = slides.findIndex((s) => s.id === slideId);
      if (slideIndex === -1) {
        return reply
          .status(404)
          .send({ error: `Slide "${slideId}" not found` });
      }

      slides[slideIndex]!.notes = notes;

      await sandboxWriteFile(
        sandboxId,
        slidesJsonPath,
        JSON.stringify(slides, null, 2),
        userId,
      );

      return reply.send({ success: true, slide: slides[slideIndex] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Failed to update slide notes");
      return reply.status(500).send({ error: message });
    }
  });

  // Start presentation mode
  app.post("/api/slides/present", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      startSlide?: number;
    };

    const { sandboxId, userId } = body;
    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      const startSlide = body.startSlide || 0;
      const previewUrl = `https://3000-${sandboxId}.e2b.dev?mode=present&slide=${startSlide}`;

      return reply.send({ success: true, previewUrl, mode: "present" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Failed to start presentation mode");
      return reply.status(500).send({ error: message });
    }
  });

  // Update slide deck state
  app.post("/api/slides/update-state", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      currentSlide: number;
      totalSlides: number;
      isPresenting: boolean;
    };

    const { sandboxId, userId, currentSlide, totalSlides, isPresenting } = body;
    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }
    if (currentSlide === undefined || totalSlides === undefined || isPresenting === undefined) {
      return reply
        .status(400)
        .send({ error: "currentSlide, totalSlides, and isPresenting required" });
    }

    try {
      const projectPath =
        body.projectPath || "/home/user/slides-project";
      const statePath = `${projectPath}/slides/slides-state.json`;

      const state = {
        currentSlide,
        totalSlides,
        isPresenting,
        updatedAt: new Date().toISOString(),
      };

      await sandboxWriteFile(
        sandboxId,
        statePath,
        JSON.stringify(state, null, 2),
        userId,
      );

      return reply.send({ success: true, state });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Failed to update slide state");
      return reply.status(500).send({ error: message });
    }
  });

  // Upload resources for slides (images, videos, etc.)
  app.post("/api/slides/upload-resources", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      filePaths: string[];
    };

    const { sandboxId, userId, filePaths } = body;
    if (!sandboxId || !userId || !filePaths?.length) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and filePaths required" });
    }

    try {
      const uploaded: { path: string; url: string }[] = [];
      const errors: { path: string; error: string }[] = [];

      for (const filePath of filePaths) {
        try {
          const result = await sandboxExec(
            sandboxId,
            `rubic-upload-file "${filePath}"`,
            userId,
            30000,
          );
          if (result.exitCode !== 0) {
            errors.push({
              path: filePath,
              error: result.stderr || "Upload failed",
            });
          } else {
            uploaded.push({ path: filePath, url: result.stdout.trim() });
          }
        } catch (uploadErr) {
          errors.push({
            path: filePath,
            error:
              uploadErr instanceof Error
                ? uploadErr.message
                : String(uploadErr),
          });
        }
      }

      return reply.send({ success: true, uploaded, errors });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Failed to upload slide resources");
      return reply.status(500).send({ error: message });
    }
  });

  // Upload a template image for slides
  app.post("/api/slides/upload-template-image", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
      projectPath?: string;
      filePath: string;
      templateName?: string;
    };

    const { sandboxId, userId, filePath } = body;
    if (!sandboxId || !userId || !filePath) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, and filePath required" });
    }

    try {
      const projectPath =
        body.projectPath || "/home/user/slides-project";
      const templateName =
        body.templateName || `template-${Date.now()}`;

      // Copy to assets directory for local reference
      const assetDest = `${projectPath}/assets/${templateName}${filePath.substring(filePath.lastIndexOf("."))}`;
      await sandboxExec(
        sandboxId,
        `cp "${filePath}" "${assetDest}"`,
        userId,
        10000,
      );

      // Upload to S3 via rubic-upload-file
      const result = await sandboxExec(
        sandboxId,
        `rubic-upload-file "${filePath}"`,
        userId,
        30000,
      );

      if (result.exitCode !== 0) {
        return reply
          .status(500)
          .send({ error: result.stderr || "Template image upload failed" });
      }

      return reply.send({
        success: true,
        url: result.stdout.trim(),
        localPath: assetDest,
        templateName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Failed to upload template image");
      return reply.status(500).send({ error: message });
    }
  });
}
