"use client";

import { useState, useRef, useCallback } from "react";

type Json = Record<string, unknown>;

const ORCHESTRATOR_URL = "http://localhost:4014";

interface TestResult {
  name: string;
  status: "pass" | "fail" | "running" | "pending";
  output: string;
  duration?: number;
}

// ─── Helpers ───
async function callJson(url: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  let data: Json;
  try {
    data = JSON.parse(text) as Json;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function extractData(json: Json): Json {
  // ApiResponse envelope: { data: {...}, meta: {...} }
  if (json.data && typeof json.data === "object") return json.data as Json;
  return json;
}

export default function TestStreamPage() {
  // State
  const [sandboxId, setSandboxId] = useState("");
  const [e2bSandboxId, setE2bSandboxId] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [streamProvider, setStreamProvider] = useState<"neko" | "novnc" | "">("");
  const [sessionId, setSessionId] = useState(`test-${Date.now()}`);
  const [prompt, setPrompt] = useState("Say hello in one sentence.");
  const [shellCmd, setShellCmd] = useState("echo 'hello from sandbox' && pwd && ls -la /home/user");
  const [filePath, setFilePath] = useState("/home/user/test.txt");
  const [fileContent, setFileContent] = useState("Hello from Rubic test-stream!");
  const [listPath, setListPath] = useState("/home/user");
  const [output, setOutput] = useState("");
  const [sseEvents, setSseEvents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [shellOutput, setShellOutput] = useState("");
  const [fileReadResult, setFileReadResult] = useState("");
  const [fileListResult, setFileListResult] = useState("");
  const [desktopReady, setDesktopReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"tests" | "browser" | "terminal" | "files">("tests");
  const abortRef = useRef<AbortController | null>(null);
  // Ref tracks latest sandboxId for tests (closure captures stale state)
  const sandboxIdRef = useRef(sandboxId);
  sandboxIdRef.current = sandboxId;

  const log = useCallback((prefix: string, msg: string) => {
    setOutput((prev) => `${prev}\n[${new Date().toISOString().slice(11, 23)}] [${prefix}] ${msg}`);
  }, []);

  const updateTest = useCallback((name: string, updates: Partial<TestResult>) => {
    setTestResults((prev) =>
      prev.map((t) => (t.name === name ? { ...t, ...updates } : t))
    );
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // ORCHESTRATOR TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function testHealth() {
    const start = Date.now();
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/health`);
      const data = await res.json();
      log("health", JSON.stringify(data));
      return { pass: data.status === "ok", output: JSON.stringify(data), duration: Date.now() - start };
    } catch (e) {
      log("health:error", String(e));
      return { pass: false, output: String(e), duration: Date.now() - start };
    }
  }

  async function testSessionCreate() {
    const start = Date.now();
    try {
      const res = await fetch(`${ORCHESTRATOR_URL}/v1/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "test-user", title: "Test Session" }),
      });
      const data = (await res.json()) as Json;
      const sid = String(data.sessionId ?? "");
      if (sid) setSessionId(sid);
      log("session:create", JSON.stringify(data));
      return { pass: !!sid, output: JSON.stringify(data), duration: Date.now() - start };
    } catch (e) {
      log("session:create:error", String(e));
      return { pass: false, output: String(e), duration: Date.now() - start };
    }
  }

  async function testSseStream(userMessage?: string) {
    const msg = userMessage ?? prompt;
    const start = Date.now();
    setSseEvents([]);
    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${ORCHESTRATOR_URL}/v1/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": "test-user" },
        body: JSON.stringify({
          messages: [{ role: "user", content: msg }],
          sessionId,
          userId: "test-user",
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        log("sse:error", `${res.status} ${text}`);
        return { pass: false, output: `${res.status} ${text}`, duration: Date.now() - start };
      }

      const reader = res.body?.getReader();
      if (!reader) return { pass: false, output: "No body", duration: Date.now() - start };

      const decoder = new TextDecoder();
      let fullText = "";
      let gotStart = false;
      let gotFinish = false;
      let gotTextDelta = false;
      let gotToolCall = false;
      let detectedSandboxId = "";
      const events: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") { events.push("[DONE]"); continue; }
          try {
            const evt = JSON.parse(payload) as Json;
            const type = String(evt.type ?? "");
            events.push(type);
            setSseEvents((prev) => [...prev, `${type}: ${JSON.stringify(evt).slice(0, 120)}`]);
            if (type === "start") gotStart = true;
            if (type === "finish") gotFinish = true;
            if (type === "text-delta") { gotTextDelta = true; fullText += String(evt.delta ?? ""); }
            if (type === "tool-input-available" || type === "tool-output-available") gotToolCall = true;
            if (type === "message-metadata" && evt.sandboxId) {
              detectedSandboxId = String(evt.sandboxId);
              setSandboxId(detectedSandboxId);
              if (evt.nekoUrl) {
                setStreamUrl(String(evt.nekoUrl));
                setStreamProvider("neko");
                setDesktopReady(true);
              }
            }
          } catch { /* non-JSON */ }
        }
      }

      abortRef.current = null;
      const summary = { events: events.length, gotStart, gotFinish, gotTextDelta, gotToolCall, sandboxId: detectedSandboxId, textPreview: fullText.slice(0, 200) };
      log("sse:complete", JSON.stringify(summary));
      return { pass: gotStart && gotFinish && gotTextDelta, output: JSON.stringify(summary, null, 2), duration: Date.now() - start };
    } catch (e) {
      log("sse:error", String(e));
      return { pass: false, output: String(e), duration: Date.now() - start };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SANDBOX OPERATIONS (via same-origin /api/sandbox/* proxy)
  // ═══════════════════════════════════════════════════════════════════════════

  async function createSandbox() {
    setBusy(true);
    setDesktopReady(false);
    try {
      const data = await callJson(`/api/sandbox`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const result = extractData(data);
      const id = String(result.id ?? "");
      const e2bId = String(result.e2bSandboxId ?? "");
      const nekoUrlFromCreate = result.nekoUrl ? String(result.nekoUrl) : "";

      if (id) { setSandboxId(id); sandboxIdRef.current = id; }
      if (e2bId) setE2bSandboxId(e2bId);

      log("sandbox:create", `id=${id} e2b=${e2bId} nekoUrl=${nekoUrlFromCreate || "none"}`);

      // If sandbox returned a Neko URL, use it directly (template has start_command.sh)
      if (nekoUrlFromCreate) {
        setStreamProvider("neko");
        log("sandbox:desktop", "Neko WebRTC template — waiting for port 8080...");

        // Poll for Neko readiness (start_command.sh waits for port 8080 before E2B reports ready)
        const pollForNeko = async () => {
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise((r) => setTimeout(r, 2000));
            try {
              await fetch(nekoUrlFromCreate, { mode: "no-cors" });
              setStreamUrl(nekoUrlFromCreate);
              setDesktopReady(true);
              log("sandbox:desktop", `Neko WebRTC ready! URL: ${nekoUrlFromCreate}`);
              return;
            } catch {
              // Not ready yet
            }
          }
          // Even if polling fails, set the URL — Neko client handles reconnection
          setStreamUrl(nekoUrlFromCreate);
          setDesktopReady(true);
          log("sandbox:desktop", "Neko polling timed out — setting URL anyway (client will reconnect)");
        };
        pollForNeko();
      } else {
        // Legacy noVNC path — poll for stream URL
        setStreamProvider("novnc");
        log("sandbox:desktop", "Legacy template — polling for noVNC on port 6080...");

        const pollForDesktop = async () => {
          for (let attempt = 0; attempt < 8; attempt++) {
            await new Promise((r) => setTimeout(r, 3000));
            try {
              const streamData = await callJson(`/api/sandbox/${id}/browser/stream`);
              const streamResult = extractData(streamData);
              const url = String(streamResult.streamUrl ?? "");
              if (url) {
                try {
                  await fetch(url.split("?")[0]!, { mode: "no-cors" });
                } catch {
                  continue;
                }
                setStreamUrl(url);
                setDesktopReady(true);
                log("sandbox:desktop", `noVNC ready! URL: ${url}`);
                return;
              }
            } catch {
              // Not ready yet
            }
          }
          log("sandbox:desktop", "Desktop setup timed out — VNC may not be available");
        };
        pollForDesktop();
      }

      return { id, e2bSandboxId: e2bId };
    } catch (e) {
      log("sandbox:create:error", String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function execShell() {
    if (!sandboxId) { log("shell", "No sandbox ID"); return; }
    setBusy(true);
    try {
      const data = await callJson(`/api/sandbox/${sandboxId}/shell`, {
        method: "POST",
        body: JSON.stringify({ command: shellCmd }),
      });
      const result = extractData(data);
      const stdout = String(result.stdout ?? "");
      const stderr = String(result.stderr ?? "");
      const exitCode = Number(result.exitCode ?? 0);
      const out = `${stdout}${stderr ? `[stderr] ${stderr}\n` : ""}${exitCode !== 0 ? `[exit: ${exitCode}]\n` : ""}`;
      setShellOutput((prev) => prev + out);
      log("shell:exec", `exit=${exitCode} stdout=${stdout.slice(0, 100)}`);
    } catch (e) {
      setShellOutput((prev) => prev + `[error] ${String(e)}\n`);
      log("shell:error", String(e));
    } finally {
      setBusy(false);
    }
  }

  async function writeFile() {
    if (!sandboxId) { log("file", "No sandbox ID"); return; }
    setBusy(true);
    try {
      const data = await callJson(`/api/sandbox/${sandboxId}/files`, {
        method: "POST",
        body: JSON.stringify({ path: filePath, content: fileContent }),
      });
      log("file:write", JSON.stringify(extractData(data)));
      setFileReadResult(`Written to ${filePath}`);
    } catch (e) {
      log("file:write:error", String(e));
      setFileReadResult(`Write error: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function readFile() {
    if (!sandboxId) { log("file", "No sandbox ID"); return; }
    setBusy(true);
    try {
      const data = await callJson(`/api/sandbox/${sandboxId}/files?path=${encodeURIComponent(filePath)}`);
      const result = extractData(data);
      setFileReadResult(String(result.content ?? "(empty)"));
      log("file:read", `path=${filePath} size=${String(result.content ?? "").length}`);
    } catch (e) {
      setFileReadResult(`Read error: ${String(e)}`);
      log("file:read:error", String(e));
    } finally {
      setBusy(false);
    }
  }

  async function listFiles() {
    if (!sandboxId) { log("file", "No sandbox ID"); return; }
    setBusy(true);
    try {
      const data = await callJson(`/api/sandbox/${sandboxId}/files/list?path=${encodeURIComponent(listPath)}`);
      const result = extractData(data);
      const files = result.files as Array<{ name: string; path: string; type: string; size?: number }>;
      const listing = files?.map((f) => `${f.type === "dir" ? "d" : "-"} ${f.name} ${f.size ? `(${f.size}B)` : ""}`).join("\n") ?? "No files";
      setFileListResult(listing);
      log("file:list", `path=${listPath} count=${files?.length ?? 0}`);
    } catch (e) {
      setFileListResult(`List error: ${String(e)}`);
      log("file:list:error", String(e));
    } finally {
      setBusy(false);
    }
  }

  async function stopSandbox() {
    if (!sandboxId) return;
    setBusy(true);
    try {
      await callJson(`/api/sandbox/${sandboxId}/stop`, { method: "POST" });
      log("sandbox:stop", `Stopped ${sandboxId}`);
      setSandboxId("");
      setE2bSandboxId("");
      setStreamUrl("");
      setStreamProvider("");
    } catch (e) {
      log("sandbox:stop:error", String(e));
    } finally {
      setBusy(false);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN ALL TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  async function runAllTests() {
    setBusy(true);
    setOutput("");
    setSseEvents([]);

    const tests: { name: string; fn: () => Promise<{ pass: boolean; output: string; duration: number }> }[] = [
      { name: "1. Orchestrator Health", fn: testHealth },
      {
        name: "2. Sandbox Health",
        fn: async () => {
          const start = Date.now();
          try {
            // Sandbox health goes through direct call since /api/sandbox doesn't proxy /health
            await fetch(`/api/sandbox`, { method: "OPTIONS" }).catch(() => null);
            // Just verify the proxy endpoint is reachable by doing a lightweight POST check
            const res2 = await fetch(`/api/sandbox`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ templateId: "__health_check__" }),
            });
            // 401 = proxy works but not authed, 200/500 = proxy works
            return { pass: res2.status !== 0, output: `Proxy responds: ${res2.status}`, duration: Date.now() - start };
          } catch (e) { return { pass: false, output: String(e), duration: Date.now() - start }; }
        },
      },
      { name: "3. Session Create", fn: testSessionCreate },
      {
        name: "4. Sandbox Create",
        fn: async () => {
          const start = Date.now();
          try {
            const result = await createSandbox();
            return { pass: !!result?.id, output: JSON.stringify(result), duration: Date.now() - start };
          } catch (e) { return { pass: false, output: String(e), duration: Date.now() - start }; }
        },
      },
      {
        name: "5. Shell Exec",
        fn: async () => {
          const sid = sandboxIdRef.current;
          if (!sid) return { pass: false, output: "No sandbox", duration: 0 };
          const start = Date.now();
          try {
            const data = await callJson(`/api/sandbox/${sid}/shell`, {
              method: "POST",
              body: JSON.stringify({ command: "echo 'test-pass' && uname -a" }),
            });
            const result = extractData(data);
            const stdout = String(result.stdout ?? "");
            return { pass: stdout.includes("test-pass"), output: stdout, duration: Date.now() - start };
          } catch (e) { return { pass: false, output: String(e), duration: Date.now() - start }; }
        },
      },
      {
        name: "6. File Write",
        fn: async () => {
          const sid = sandboxIdRef.current;
          if (!sid) return { pass: false, output: "No sandbox", duration: 0 };
          const start = Date.now();
          try {
            const data = await callJson(`/api/sandbox/${sid}/files`, {
              method: "POST",
              body: JSON.stringify({ path: "/home/user/test-auto.txt", content: "automated-test-content" }),
            });
            const result = extractData(data);
            return { pass: !!result.written, output: JSON.stringify(result), duration: Date.now() - start };
          } catch (e) { return { pass: false, output: String(e), duration: Date.now() - start }; }
        },
      },
      {
        name: "7. File Read",
        fn: async () => {
          const sid = sandboxIdRef.current;
          if (!sid) return { pass: false, output: "No sandbox", duration: 0 };
          const start = Date.now();
          try {
            const data = await callJson(`/api/sandbox/${sid}/files?path=${encodeURIComponent("/home/user/test-auto.txt")}`);
            const result = extractData(data);
            const content = String(result.content ?? "");
            return { pass: content === "automated-test-content", output: content, duration: Date.now() - start };
          } catch (e) { return { pass: false, output: String(e), duration: Date.now() - start }; }
        },
      },
      {
        name: "8. File List",
        fn: async () => {
          const sid = sandboxIdRef.current;
          if (!sid) return { pass: false, output: "No sandbox", duration: 0 };
          const start = Date.now();
          try {
            const data = await callJson(`/api/sandbox/${sid}/files/list?path=${encodeURIComponent("/home/user")}`);
            const result = extractData(data);
            const files = result.files as Array<{ name: string }>;
            return { pass: Array.isArray(files) && files.length > 0, output: files?.map((f) => f.name).join(", ") ?? "empty", duration: Date.now() - start };
          } catch (e) { return { pass: false, output: String(e), duration: Date.now() - start }; }
        },
      },
      {
        name: "9. SSE Stream (Simple)",
        fn: () => testSseStream("Say hello in one sentence."),
      },
      {
        name: "10. Browser Stream URL",
        fn: async () => {
          const sid = sandboxIdRef.current;
          if (!sid) return { pass: false, output: "No sandbox", duration: 0 };
          const start = Date.now();
          try {
            const data = await callJson(`/api/sandbox/${sid}/browser/stream`);
            const result = extractData(data);
            const url = String(result.streamUrl ?? "");
            const provider = String(result.provider ?? "unknown");
            if (url) setStreamUrl(url);
            if (provider === "neko" || provider === "novnc") setStreamProvider(provider);
            return { pass: url.includes("e2b.app"), output: `[${provider}] ${url}`, duration: Date.now() - start };
          } catch (e) { return { pass: false, output: String(e), duration: Date.now() - start }; }
        },
      },
    ];

    const results: TestResult[] = tests.map((t) => ({ name: t.name, status: "pending" as const, output: "" }));
    setTestResults(results);

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i]!;
      updateTest(test.name, { status: "running" });
      log("test", `Running: ${test.name}`);
      const result = await test.fn();
      updateTest(test.name, { status: result.pass ? "pass" : "fail", output: result.output, duration: result.duration });
      log("test", `${result.pass ? "PASS" : "FAIL"}: ${test.name} (${result.duration}ms)`);
    }

    setBusy(false);
  }

  function stopStream() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  const statusIcon = (s: TestResult["status"]) =>
    s === "pass" ? "+" : s === "fail" ? "x" : s === "running" ? "~" : "o";
  const statusColor = (s: TestResult["status"]) =>
    s === "pass" ? "text-green-600" : s === "fail" ? "text-red-600" : s === "running" ? "text-yellow-600" : "text-gray-400";

  const tabs = [
    { id: "tests" as const, label: "Tests" },
    { id: "browser" as const, label: "Browser" },
    { id: "terminal" as const, label: "Terminal" },
    { id: "files" as const, label: "Files" },
  ];

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Rubic Test Suite</h1>
          <p className="text-xs text-muted-foreground">
            Orchestrator (:4014) | Sandbox (via /api/sandbox proxy) | WebRTC-Media (:4016)
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono">Sandbox: {sandboxId || "none"}</span>
          {sandboxId && (
            <button className="text-red-600 underline" onClick={stopSandbox}>
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Sandbox Status Bar */}
      <div className="flex items-center gap-3 p-2 border rounded text-xs bg-muted/30">
        <button
          className="bg-blue-600 text-white rounded px-3 py-1 font-medium disabled:opacity-50"
          onClick={createSandbox}
          disabled={busy || !!sandboxId}
        >
          {sandboxId ? "Sandbox Active" : "Create Sandbox"}
        </button>
        {e2bSandboxId && <span className="font-mono text-muted-foreground">E2B: {e2bSandboxId}</span>}
        {streamProvider && <span className="font-mono text-muted-foreground">{streamProvider === "neko" ? "Neko WebRTC" : "noVNC"}</span>}
        {streamUrl && (
          <a href={streamUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate max-w-xs">
            {streamUrl}
          </a>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* ── Tests Tab ── */}
        {activeTab === "tests" && (
          <div className="space-y-4 h-full overflow-y-auto">
            {/* Config */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-xs block">
                Session ID
                <input className="w-full border rounded px-2 py-1 mt-1 font-mono text-xs" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
              </label>
              <label className="text-xs block">
                Prompt
                <input className="w-full border rounded px-2 py-1 mt-1 font-mono text-xs" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              </label>
              <div className="flex items-end gap-2">
                <button className="bg-blue-600 text-white rounded px-4 py-1 text-sm font-medium disabled:opacity-50" onClick={runAllTests} disabled={busy}>
                  Run All Tests
                </button>
                <button className="bg-green-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50" onClick={() => { setBusy(true); testSseStream().then(() => setBusy(false)); }} disabled={busy}>
                  SSE Only
                </button>
                <button className="border rounded px-3 py-1 text-sm" onClick={stopStream}>
                  Stop
                </button>
                <button className="border rounded px-3 py-1 text-sm" onClick={() => { setOutput(""); setSseEvents([]); setTestResults([]); }}>
                  Clear
                </button>
              </div>
            </div>

            {/* Test Results */}
            {testResults.length > 0 && (
              <div className="border rounded p-3">
                <h2 className="font-medium text-sm mb-2">Test Results</h2>
                <div className="space-y-1">
                  {testResults.map((t) => (
                    <div key={t.name} className="flex items-start gap-2 text-xs">
                      <span className={`font-bold ${statusColor(t.status)}`}>[{statusIcon(t.status)}]</span>
                      <span className="font-medium min-w-[180px]">{t.name}</span>
                      {t.duration != null && <span className="text-muted-foreground">{t.duration}ms</span>}
                      {t.output && (
                        <span className="text-muted-foreground truncate max-w-md">{t.output.slice(0, 150)}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t text-xs font-medium">
                  {testResults.filter((t) => t.status === "pass").length}/{testResults.length} passed
                </div>
              </div>
            )}

            {/* SSE Events */}
            {sseEvents.length > 0 && (
              <div className="border rounded p-3">
                <h2 className="font-medium text-sm mb-1">SSE Events ({sseEvents.length})</h2>
                <pre className="text-xs h-32 overflow-auto whitespace-pre-wrap font-mono">
                  {sseEvents.map((e, i) => `${i + 1}. ${e}`).join("\n")}
                </pre>
              </div>
            )}

            {/* Output Log */}
            <div>
              <h2 className="font-medium text-sm mb-1">Output Log</h2>
              <pre className="text-xs border rounded p-2 h-40 overflow-auto whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900">
                {output || "(empty)"}
              </pre>
            </div>
          </div>
        )}

        {/* ── Browser Tab ── */}
        {activeTab === "browser" && (
          <div className="h-full flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium">
                {streamProvider === "neko" ? "Neko WebRTC Desktop" : streamProvider === "novnc" ? "noVNC Browser Stream" : "Browser Stream"}
              </span>
              {!sandboxId && <span className="text-muted-foreground">(Create a sandbox first)</span>}
              {sandboxId && !desktopReady && !streamUrl && (
                <span className="text-yellow-600 animate-pulse">
                  {streamProvider === "neko" ? "Starting Neko WebRTC desktop..." : "Starting desktop environment..."}
                </span>
              )}
              {streamUrl && (
                <>
                  <span className="text-green-600">Desktop ready</span>
                  <a href={streamUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    Open in new tab
                  </a>
                </>
              )}
              {sandboxId && !streamUrl && desktopReady && (
                <button
                  className="text-blue-600 underline"
                  onClick={async () => {
                    try {
                      const data = await callJson(`/api/sandbox/${sandboxId}/browser/stream`);
                      const result = extractData(data);
                      const url = String(result.streamUrl ?? "");
                      const provider = String(result.provider ?? "");
                      if (url) setStreamUrl(url);
                      if (provider === "neko" || provider === "novnc") setStreamProvider(provider);
                    } catch (e) {
                      log("browser:stream:error", String(e));
                    }
                  }}
                >
                  Get Stream URL
                </button>
              )}
            </div>
            {streamUrl ? (
              <iframe
                src={streamUrl}
                className="flex-1 w-full border rounded bg-black"
                allow="clipboard-read; clipboard-write; autoplay; microphone; camera; display-capture"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center border rounded bg-muted/20 text-muted-foreground text-sm">
                {sandboxId ? (
                  <div className="text-center space-y-2">
                    <div className="animate-pulse">Setting up desktop environment...</div>
                    <div className="text-xs">
                      {streamProvider === "neko"
                        ? "Starting XFCE + Neko WebRTC (H.264 streaming)..."
                        : "Starting Xvfb + x11vnc + noVNC + Chromium (~15 seconds)"}
                    </div>
                  </div>
                ) : (
                  "Create a sandbox to start browser streaming"
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Terminal Tab ── */}
        {activeTab === "terminal" && (
          <div className="h-full flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-mono text-sm">$</span>
              <input
                className="flex-1 border rounded px-2 py-1 font-mono text-xs bg-gray-950 text-green-400"
                value={shellCmd}
                onChange={(e) => setShellCmd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !busy && sandboxId) {
                    // Append command to output before executing
                    setShellOutput((prev) => `${prev}$ ${shellCmd}\n`);
                    execShell();
                  }
                }}
                placeholder="Enter shell command..."
                disabled={!sandboxId || busy}
              />
              <button
                className="bg-green-600 text-white rounded px-4 py-1 text-sm font-medium disabled:opacity-50"
                onClick={() => {
                  setShellOutput((prev) => `${prev}$ ${shellCmd}\n`);
                  execShell();
                }}
                disabled={busy || !sandboxId}
              >
                Run
              </button>
              <button className="border rounded px-3 py-1 text-xs" onClick={() => setShellOutput("")}>
                Clear
              </button>
            </div>
            <pre className="flex-1 border rounded p-3 font-mono text-xs bg-gray-950 text-green-400 overflow-auto whitespace-pre-wrap">
              {sandboxId
                ? shellOutput || "# Sandbox terminal ready. Type a command above.\n# Examples: ls -la, pwd, echo hello, python3 -c \"print('hi')\""
                : "# Create a sandbox first to use the terminal"}
            </pre>
          </div>
        )}

        {/* ── Files Tab ── */}
        {activeTab === "files" && (
          <div className="h-full flex flex-col gap-3 overflow-y-auto">
            {/* Write */}
            <div className="border rounded p-3 space-y-2">
              <h3 className="font-medium text-sm">Write File</h3>
              <div className="flex gap-2">
                <input className="flex-1 border rounded px-2 py-1 font-mono text-xs" value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="/home/user/file.txt" />
                <button className="bg-blue-600 text-white rounded px-3 py-1 text-xs disabled:opacity-50" onClick={writeFile} disabled={busy || !sandboxId}>
                  Write
                </button>
                <button className="border rounded px-3 py-1 text-xs disabled:opacity-50" onClick={readFile} disabled={busy || !sandboxId}>
                  Read
                </button>
              </div>
              <textarea
                className="w-full border rounded px-2 py-1 font-mono text-xs h-24"
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="File content..."
              />
              {fileReadResult && (
                <pre className="text-xs border rounded p-2 bg-muted/30 max-h-32 overflow-auto whitespace-pre-wrap font-mono">
                  {fileReadResult}
                </pre>
              )}
            </div>

            {/* List */}
            <div className="border rounded p-3 space-y-2">
              <h3 className="font-medium text-sm">List Files</h3>
              <div className="flex gap-2">
                <input className="flex-1 border rounded px-2 py-1 font-mono text-xs" value={listPath} onChange={(e) => setListPath(e.target.value)} placeholder="/home/user" />
                <button className="border rounded px-3 py-1 text-xs disabled:opacity-50" onClick={listFiles} disabled={busy || !sandboxId}>
                  List
                </button>
              </div>
              {fileListResult && (
                <pre className="text-xs border rounded p-2 bg-muted/30 max-h-48 overflow-auto whitespace-pre-wrap font-mono">
                  {fileListResult}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
