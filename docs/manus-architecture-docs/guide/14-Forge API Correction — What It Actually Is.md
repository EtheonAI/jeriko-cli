# Part 14: Forge API Correction — What It Actually Is

**Date:** 2026-02-10
**Status:** CORRECTION to Parts 5, 9, 10, 11, 13

---

## 1. What I Got Wrong

In multiple previous documents, I claimed:

> "Forge API provides LLM completion, image generation, voice transcription, notifications, maps, S3 storage"

> "OPENAI_BASE_URL points to Forge proxy"

**Both claims were partially wrong.** Here's the corrected architecture.

---

## 2. The Actual Architecture

There are **TWO separate AI service endpoints** in Manus:

### Endpoint 1: LLM Proxy (For Sandbox Execution)

| Property | Value |
|----------|-------|
| **URL** | `https://api.manus.im/api/llm-proxy/v1` |
| **Env Var** | `OPENAI_BASE_URL` |
| **Auth** | `OPENAI_API_KEY` (the `sandbox_api_token`) |
| **Used By** | Sandbox processes (map tool subtasks, user code) |
| **Models** | `gpt-4.1-mini`, `gpt-4.1-nano`, `gemini-2.5-flash` |
| **Purpose** | Restricted, cheap models for subtask execution |
| **Format** | OpenAI-compatible `/chat/completions` endpoint |

**Live verification:**
```bash
$ echo $OPENAI_BASE_URL
https://api.manus.im/api/llm-proxy/v1

$ curl -X POST "$OPENAI_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model":"gpt-4o-mini","messages":[...]}'
# Returns: {"error":"Unsupported model. Only the following models are allowed: gpt-4.1-mini, gpt-4.1-nano, gemini-2.5-flash"}
```

### Endpoint 2: Forge API (For Webdev Projects)

| Property | Value |
|----------|-------|
| **URL** | `https://forge.manus.ai` |
| **Env Vars** | `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` (server), `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` (client) |
| **Used By** | Webdev projects (full-stack apps built by users) |
| **Services** | LLM completion, image generation, voice transcription (Whisper) |
| **Purpose** | Full AI capabilities for user-built applications |
| **Formats** | OpenAI-compatible + Connect Protocol (gRPC-Web) |

**Live verification:**
```bash
$ env | grep FORGE
BUILT_IN_FORGE_API_URL=https://forge.manus.ai
BUILT_IN_FORGE_API_KEY=iYteMZid8PPv8NczekKsfj
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.ai
VITE_FRONTEND_FORGE_API_KEY=oAKMj8nzHn3pHkW4hX7t5s
```

---

## 3. Forge API Services (Verified from Templates)

### Service 1: LLM Completion

**Endpoint:** `https://forge.manus.ai/v1/chat/completions`
**Format:** OpenAI-compatible
**Template:** `/opt/.manus/webdev/templates/.../server/_core/llm.ts`

**Key details:**
- Default model: `gemini-2.5-flash`
- Supports: tools, structured output (json_schema), multimodal (text/image/file)
- Max tokens: 32768
- Thinking budget: 128 tokens

**Usage in webdev projects:**
```typescript
import { invokeLLM } from "server/_core/llm";

const result = await invokeLLM({
  messages: [{ role: "user", content: "Hello" }],
  tools: [...],
  outputSchema: { name: "response", schema: {...} }
});
```

### Service 2: Image Generation

**Endpoint:** `https://forge.manus.ai/images.v1.ImageService/GenerateImage`
**Format:** Connect Protocol (gRPC-Web)
**Template:** `/opt/.manus/webdev/templates/.../server/_core/imageGeneration.ts`

**Key details:**
- Supports: text-to-image, image-to-image editing
- Returns: base64-encoded image
- Auto-uploads to S3 after generation

**Usage in webdev projects:**
```typescript
import { generateImage } from "server/_core/imageGeneration";

const { url } = await generateImage({
  prompt: "A serene landscape with mountains",
  originalImages: [{ url: "...", mimeType: "image/jpeg" }] // optional
});
```

### Service 3: Voice Transcription (Whisper)

**Endpoint:** `https://forge.manus.ai/v1/audio/transcriptions`
**Format:** OpenAI Whisper-compatible (multipart/form-data)
**Template:** `/opt/.manus/webdev/templates/.../server/_core/voiceTranscription.ts`

**Key details:**
- Model: `whisper-1`
- Response format: `verbose_json` (includes segments with timestamps)
- Max file size: 16MB
- Supported formats: webm, mp3, wav, ogg, m4a

**Usage in webdev projects:**
```typescript
import { transcribeAudio } from "server/_core/voiceTranscription";

const result = await transcribeAudio({
  audioUrl: "https://...",
  language: "en", // optional
  prompt: "Transcribe the meeting" // optional
});

if ('error' in result) {
  // Handle error
} else {
  console.log(result.text); // Full transcription
  console.log(result.segments); // Timestamped segments
}
```

---

## 4. What About Notifications, Maps, Storage?

**I found templates for these, but they DON'T use Forge API:**

### Notifications

**Template:** `/opt/.manus/webdev/templates/.../server/_core/notification.ts`
**Endpoint:** NOT Forge — uses Manus's built-in notification system
**Requires:** `webdev_add_feature` with `feature="web-db-user"` to unlock

### Maps

**Template:** `/opt/.manus/webdev/templates/.../server/_core/map.ts`
**Endpoint:** NOT Forge — uses Google Maps proxy via `VITE_FRONTEND_FORGE_API_KEY`
**Note:** The "map" here is Google Maps integration, NOT the parallel processing `map` tool

### Storage (S3)

**Template:** `/opt/.manus/webdev/templates/.../server/storage.ts`
**Endpoint:** NOT Forge — direct S3 upload/download
**Functions:** `storagePut()`, `storageGet()`

---

## 5. Corrected Service Boundary

| Service | What It Provides | Used By |
|---------|-----------------|---------|
| **LLM Proxy** | OpenAI/Google models (restricted) | Sandbox (map subtasks, user code) |
| **Forge API** | LLM + Image Gen + Voice Transcription | Webdev projects |
| **Manus Notification API** | Push notifications | Webdev projects (after upgrade) |
| **Google Maps Proxy** | Maps integration | Webdev projects (frontend) |
| **S3 Direct** | File storage | Webdev projects |

---

## 6. Why I Was Confused

**The confusion came from:**

1. **Two different "LLM proxy" endpoints** — one for sandbox (`OPENAI_BASE_URL`), one for webdev (`FORGE_API_URL`)
2. **"Forge" in env var names** — `BUILT_IN_FORGE_API_KEY` and `VITE_FRONTEND_FORGE_API_KEY` are both for Forge API, but they have different permissions
3. **My /health test failed** — I tested `https://forge.manus.ai/health` (wrong endpoint). The actual endpoints are `/v1/chat/completions`, `/images.v1.ImageService/GenerateImage`, `/v1/audio/transcriptions`

---

## 7. Impact on Previous Documents

### Documents That Need Correction:

| Doc | Section | What's Wrong | Correction |
|-----|---------|-------------|-----------|
| Part 5 (Connectors) | Forge API section | Says "Forge provides 7 services" | Only 3 services: LLM, image gen, voice |
| Part 9 (Corrected Agent Architecture) | LLM routing | Conflates LLM Proxy with Forge API | Separate them clearly |
| Part 10 (Contradiction Register) | Forge API | Incomplete service list | Add image gen, voice transcription |
| Part 11 (Codex Analysis) | Gap 1: Forge API | Says "missing Forge API tasks" | Clarify: only LLM, image, voice |
| Part 13 (Claude Plan Analysis) | Gap H5: Forge API | Says "7 service endpoints" | Only 3 endpoints |

### Documents That Are Correct:

- Part 7 (Orchestrator Agents) — doesn't mention Forge
- Part 8 (Env Variables) — correctly lists all Forge env vars
- Part 12 (WebDev Analysis) — doesn't mention Forge

---

## 8. Corrected Implementation Tasks for Claude's Plan

**Replace Gap H5 in Part 13 with:**

### Phase 1: Contracts

**P1.X: Define Forge API request/response schemas**
- LLM completion: OpenAI-compatible format
- Image generation: Connect Protocol format
- Voice transcription: Whisper-compatible format

### Phase 2: Orchestrator

**P2.X: Implement Forge API adapter**
- LLM client (for webdev LLM calls)
- Image generation client (Connect Protocol)
- Voice transcription client (multipart/form-data)

### Phase 4: Tool Parity

**P4.X: Test Forge API integration**
- Test LLM completion with all supported models
- Test image generation (text-to-image, image-to-image)
- Test voice transcription with all supported formats

---

## 9. Final Corrected Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Manus Orchestrator                        │
│                  (Claude 3.5 Sonnet)                         │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
            │                                 │
    ┌───────▼────────┐                ┌──────▼──────────┐
    │  LLM Proxy     │                │   Forge API     │
    │  (Sandbox)     │                │   (Webdev)      │
    └───────┬────────┘                └──────┬──────────┘
            │                                 │
            │                                 │
    ┌───────▼────────────────┐       ┌───────▼────────────────────┐
    │ gpt-4.1-mini           │       │ LLM: gemini-2.5-flash      │
    │ gpt-4.1-nano           │       │ Image: GenerateImage       │
    │ gemini-2.5-flash       │       │ Voice: Whisper API         │
    └────────────────────────┘       └────────────────────────────┘
            │                                 │
            │                                 │
    ┌───────▼────────────────┐       ┌───────▼────────────────────┐
    │ Map Tool Subtasks      │       │ User Webdev Projects       │
    │ (Separate E2B sandboxes│       │ (tRPC routes call Forge)   │
    └────────────────────────┘       └────────────────────────────┘
```

---

**Document Version:** 1.0.0
**Author:** Manus AI
**Supersedes:** Forge API sections in Parts 5, 9, 10, 11, 13
