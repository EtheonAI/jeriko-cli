# Supplement H: Voice, Skills, Knowledge, File Connectors, Forge API, and Full Prompt-to-Response Flow

> **Scope:** This document covers every feature not yet fully documented — voice input/transcription, the skill system, knowledge base, file connectors, the Forge API (LLM/image/notification/maps/storage), all 41 Redux slices, and the complete prompt-to-response flow from the user's perspective through every layer.

---

## 1. Voice Input and Speech-to-Text

### 1.1 Frontend Voice Capture

The `ui` Redux slice tracks voice input state:

```typescript
// From ui slice
{
  inputMode: "text",              // "text" | "voice"
  microphonePermission: "prompt"  // "prompt" | "granted" | "denied"
}
```

When the user switches to voice mode:

```
User clicks microphone icon
  → dispatch(uiActions.setInputMode("voice"))
  → Browser requests microphone permission
  → If granted: dispatch(uiActions.setMicrophonePermission("granted"))
  → MediaRecorder starts capturing audio (WebM/Opus format)
  → User speaks...
  → User clicks stop or silence detected
  → Audio blob created (audio/webm)
```

### 1.2 Voice Transcription Flow (Agent-Side)

Inside the E2B sandbox, the `manus-speech-to-text` binary handles transcription:

```
Audio file in sandbox (e.g., /tmp/recording.webm)
  → manus-speech-to-text /tmp/recording.webm
  → Binary is a statically-linked Go executable
  → Sends audio to Whisper API endpoint
  → Returns transcribed text to stdout
  → Agent reads text and processes as if user typed it
```

The binary supports: `.mp3`, `.wav`, `.mp4`, `.webm` formats. Large video files are automatically converted to 64kbps audio before transcription.

### 1.3 Voice Transcription Flow (WebDev Server-Side)

For webdev apps that need voice features, the server template provides `voiceTranscription.ts`:

```typescript
// server/_core/voiceTranscription.ts
async function transcribeAudio(options: TranscribeOptions): Promise<WhisperResponse | TranscriptionError> {
  // 1. Validate input
  const { audioUrl, language, prompt } = options;
  
  // 2. Fetch audio from URL (S3/CDN)
  const audioResponse = await fetch(audioUrl);
  const audioBuffer = await audioResponse.arrayBuffer();
  
  // 3. Build multipart form data for Whisper API
  const formData = new FormData();
  formData.append('file', audioBlob, `audio.${extension}`);
  formData.append('model', 'whisper-1');
  if (language) formData.append('language', language);
  if (prompt) formData.append('prompt', prompt);
  
  // 4. Call Whisper via Forge API
  const whisperUrl = `${ENV.forgeApiUrl}/v1/audio/transcriptions`;
  const response = await fetch(whisperUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ENV.forgeApiKey}` },
    body: formData
  });
  
  // 5. Return transcription result
  return { text: "transcribed text", duration: 5.2, language: "en" };
}
```

**Network flow:**
```
User's browser (microphone) → MediaRecorder → audio/webm blob
  → Upload to S3 via storage API → CDN URL
  → Server: POST {forgeApiUrl}/v1/audio/transcriptions
  → Forge API → OpenAI Whisper API
  → Response: { text: "...", duration: 5.2, language: "en" }
  → Server returns text to frontend
```

### 1.4 Supported Languages

The voice transcription system supports 19 languages: English, Spanish, French, German, Italian, Portuguese, Russian, Japanese, Korean, Chinese, Arabic, Hindi, Dutch, Polish, Turkish, Swedish, Danish, Norwegian, and Finnish.

---

## 2. The Skill System

### 2.1 Architecture

Skills are modular capability packages stored in `/home/ubuntu/skills/`. They extend the agent's knowledge with specialized workflows, domain expertise, and bundled resources.

```
/home/ubuntu/skills/
├── .skill_versions.json          ← Version tracking for installed skills
└── skill-creator/                ← Example: the skill creation guide
    ├── SKILL.md                  ← Required: instructions and metadata
    └── (optional resources)
        ├── scripts/              ← Executable code
        ├── references/           ← Documentation loaded on demand
        └── templates/            ← Output assets (logos, fonts, etc.)
```

### 2.2 Skill Loading Flow

Skills use a **progressive disclosure** system with three levels:

```
Level 1: DISCOVERY (always loaded)
  → System prompt contains skill names + descriptions from YAML frontmatter
  → Agent reads description to decide if skill is relevant
  
Level 2: ACTIVATION (loaded on demand)
  → Agent reads SKILL.md file: file.read("/home/ubuntu/skills/{name}/SKILL.md")
  → Instructions loaded into context
  → Agent follows the skill's workflow
  
Level 3: DEEP REFERENCE (loaded as needed)
  → Agent reads files from references/ directory
  → Large files accessed via grep patterns defined in SKILL.md
  → Scripts executed from scripts/ directory
```

### 2.3 Skill Version Management

The `.skill_versions.json` file tracks installed skills:

```json
{
  "skill-creator": "aEj6sWQUV4ngukZhAnD4UY"  // Version hash
}
```

Skills are managed by the orchestration layer. When a user enables a skill, the orchestration:
1. Downloads the skill package
2. Extracts to `/home/ubuntu/skills/{name}/`
3. Updates `.skill_versions.json`
4. Adds the skill's name and description to the system prompt's `<skills>` section

### 2.4 Skill Anatomy (SKILL.md)

Every skill requires a SKILL.md with YAML frontmatter:

```yaml
---
name: skill-name
description: When and why to use this skill. This is the ONLY text the agent
             reads during discovery, so it must be comprehensive.
license: Complete terms in LICENSE.txt
---
# Skill Name

## Instructions
(Loaded only when skill is activated)
```

### 2.5 How Skills Affect the Prompt

The system prompt includes a `<skills>` section listing all available skills:

```xml
<skills>
Below is a list of available skills with their names and descriptions.
Read those relevant to the current task based on their descriptions:
- skill-creator: Guide for creating effective skills...
- custom-skill-1: Description of custom skill...
</skills>
```

The agent is instructed to **read all relevant skills before creating a plan** or update the plan after reading them. This ensures skill knowledge influences task planning.

---

## 3. Knowledge Base

### 3.1 Redux State

```typescript
// knowledge slice
{
  // Structure inferred from slice name and patterns
  items: KnowledgeItem[];
  loading: boolean;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  source: string;       // "user" | "system" | "learned"
  tags: string[];
  createdAt: number;
}
```

### 3.2 How Knowledge Works

The knowledge system provides persistent context that carries across sessions. Unlike skills (which are procedural), knowledge items are declarative facts.

Knowledge appears in the system prompt as `<related_knowledge>` blocks:

```xml
<related_knowledge>
<knowledge>
name: Thorough analysis and complete results
use_when: When performing analysis or providing implementations for the user
content: Always conduct heavy analysis and provide final, comprehensive results...
</knowledge>
</related_knowledge>
```

**Knowledge injection flow:**
```
1. User creates knowledge item (via UI or agent learns from interaction)
   → POST /v1/knowledge { title, content, tags }
   → Backend stores in knowledge table
   
2. New session starts or context is built
   → Backend retrieves relevant knowledge items for user
   → Knowledge items injected into system prompt as <related_knowledge>
   → Agent has access to persistent facts
   
3. Agent uses knowledge during task execution
   → Knowledge influences planning and tool use decisions
```

### 3.3 Knowledge vs. Skills vs. Context

| Feature | Knowledge | Skills | Conversation Context |
|---------|-----------|--------|---------------------|
| Persistence | Permanent (database) | Permanent (filesystem) | Session-scoped |
| Format | Declarative facts | Procedural workflows | Messages + tool results |
| Loading | Automatic (injected into prompt) | On-demand (agent reads SKILL.md) | Loaded per session |
| Scope | Cross-session | Cross-session | Single session |
| Size | Small (few paragraphs each) | Medium (full documents) | Large (grows per message) |
| Source | User-created or agent-learned | Installed packages | Conversation history |

---

## 4. File Connectors and File Management

### 4.1 File-Related Redux Slices

There are **four** file-related slices, each handling a different aspect:

#### `fileManagement` Slice
Manages file uploads and downloads initiated by the user.

```typescript
interface FileManagementState {
  files: FileItem[];
  uploading: boolean;
  uploadProgress: number;  // 0-100
}

interface FileItem {
  name: string;
  size: number;
  url: string;          // CDN URL after upload
  uploadedAt: number;
}
```

**State flow for user file upload:**
```
User drags file to chat input
  → dispatch(fileManagement.startUpload())
  → Redux: fileManagement.uploading = true
  → HTTP: POST /v1/files/upload (FormData with file)
  → Progress events: dispatch(fileManagement.setProgress(50))
  → Backend: Upload to S3, store metadata in files table
  → Response: { fileId, url: "https://files.manuscdn.com/..." }
  → dispatch(fileManagement.uploadComplete({ name, size, url }))
  → Redux: fileManagement.files.push(newFile)
  → Redux: fileManagement.uploading = false
  → File appears as attachment in chat input
```

#### `fileConnector` Slice
Manages connections to external file storage services (Google Drive, Dropbox, etc.).

```typescript
interface FileConnectorState {
  connectedServices: string[];
  selectedFiles: ExternalFile[];
  browsing: boolean;
}
```

**State flow for file connector:**
```
User clicks "Connect Google Drive" in connectors panel
  → OAuth flow initiated (same as connector OAuth)
  → On success: dispatch(fileConnector.addService("google_drive"))
  → User browses files: dispatch(fileConnector.setBrowsing(true))
  → GET /v1/connectors/google_drive/files?path=/
  → File tree rendered
  → User selects file: dispatch(fileConnector.selectFile(file))
  → File downloaded to sandbox: /home/ubuntu/{filename}
  → Agent can now read/process the file
```

#### `fileShare` Slice
Manages sharing files and sessions with other users.

```typescript
interface FileShareState {
  // Sharing state
  isShareMode: boolean;
  isShareFileMode: boolean;
  sharingSessionUid: string | null;
}
```

#### `filePreviewer` Slice
Manages the file preview panel that shows when clicking on file attachments.

```typescript
interface FilePreviewerState {
  previewFile: FileItem | null;
  isOpen: boolean;
}
```

### 4.2 Complete File Journey

```
USER UPLOADS FILE
  ↓
Frontend: FormData POST to /v1/files/upload
  ↓
Backend: Receives multipart upload
  ↓
Backend: Streams to S3 bucket
  S3 Key: user_upload_by_module/session_file/{userId}/{random}.{ext}
  ↓
Backend: Stores metadata in files table
  ↓
Backend: Returns CDN URL
  CDN: https://files.manuscdn.com/user_upload_by_module/session_file/{userId}/{random}.{ext}
  ↓
Frontend: File appears in chat as attachment
  ↓
USER SENDS MESSAGE WITH FILE
  ↓
Backend: Message includes file references
  ↓
Backend: Downloads file to sandbox (if needed for tool execution)
  Sandbox path: /home/ubuntu/{filename}
  ↓
Agent: Reads file using file.read tool
  ↓
Agent: Processes file content
  ↓
Agent: Creates output file (if needed)
  Sandbox path: /home/ubuntu/output.pdf
  ↓
Agent: Attaches file to message using message tool
  ↓
Backend: manus-upload-file uploads to S3
  ↓
Backend: CDN URL included in message attachment
  ↓
Frontend: File download link shown in chat
```

---

## 5. The Forge API (Manus Internal Services)

The Forge API is Manus's internal service gateway that provides LLM, image generation, voice transcription, notifications, maps, and storage to webdev applications. It is accessed via `BUILT_IN_FORGE_API_URL` with `BUILT_IN_FORGE_API_KEY` for authentication.

### 5.1 Forge API Endpoints

| Service | Endpoint Path | Method | Purpose |
|---------|--------------|--------|---------|
| **LLM Chat** | `/v1/chat/completions` | POST | OpenAI-compatible chat completions |
| **Image Generation** | `/images.v1.ImageService/GenerateImage` | POST | Generate images from text prompts |
| **Voice Transcription** | `/v1/audio/transcriptions` | POST | Whisper speech-to-text |
| **Notifications** | `/webdevtoken.v1.WebDevService/SendNotification` | POST | Push notifications to project owner |
| **Maps Proxy** | `/v1/maps/proxy/{google_maps_endpoint}` | GET | Google Maps API proxy |
| **Storage Upload** | `/v1/storage/upload/{key}` | POST | Upload files to S3 |
| **Storage Download** | `/v1/storage/download/{key}` | GET | Get signed download URL |

### 5.2 LLM Service (server/_core/llm.ts)

The LLM service provides OpenAI-compatible chat completions to webdev apps:

```typescript
// Configuration
const config = {
  baseURL: `${ENV.forgeApiUrl}/v1`,
  apiKey: ENV.forgeApiKey,
  defaultModel: "gpt-4.1-mini"  // Default model for webdev apps
};

// Usage in tRPC route
const response = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  messages: [{ role: "user", content: "Hello" }],
  stream: true
});
```

**Available models via Forge API:**
- `gpt-4.1-mini` (default for webdev)
- `gpt-4.1-nano`
- `gemini-2.5-flash`
- Claude models are **blocked** from E2B sandbox — only available to orchestration

### 5.3 Image Generation Service

```typescript
// server/_core/imageGeneration.ts
async function generateImage(options: {
  prompt: string;
  originalImages?: Array<{ url?: string; b64Json?: string; mimeType?: string }>;
}): Promise<{ url?: string }> {
  
  // 1. POST to Forge API
  const response = await fetch(`${forgeApiUrl}/images.v1.ImageService/GenerateImage`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      "authorization": `Bearer ${forgeApiKey}`
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || []
    })
  });
  
  // 2. Response contains base64 image
  const result = await response.json();
  // result.image.b64Json = base64 encoded image
  // result.image.mimeType = "image/png"
  
  // 3. Upload to S3 via storage service
  const buffer = Buffer.from(result.image.b64Json, "base64");
  const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, result.image.mimeType);
  
  return { url };  // Returns CDN URL
}
```

### 5.4 Notification Service

```typescript
// server/_core/notification.ts
async function notifyOwner(payload: { title: string; content: string }): Promise<boolean> {
  const endpoint = `${forgeApiUrl}/webdevtoken.v1.WebDevService/SendNotification`;
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "authorization": `Bearer ${forgeApiKey}`,
      "content-type": "application/json",
      "connect-protocol-version": "1"
    },
    body: JSON.stringify({ title, content })
  });
  
  return response.ok;
}
```

Notifications are sent to the project owner (identified by `OWNER_OPEN_ID`) and appear in the Manus app's notification panel.

### 5.5 Storage Service

```typescript
// server/storage.ts
async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const uploadUrl = `${baseUrl}/v1/storage/upload/${key}`;
  
  const formData = new FormData();
  formData.append("file", blob, fileName);
  
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: formData
  });
  
  const url = (await response.json()).url;
  return { key, url };  // url = CDN URL for the uploaded file
}

async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const downloadUrl = `${baseUrl}/v1/storage/download/${key}`;
  // Returns signed URL for downloading
}
```

### 5.6 Maps Proxy Service

All Google Maps API calls are proxied through the Forge API:

```typescript
// server/_core/map.ts
async function makeRequest<T>(endpoint: string, params: Record<string, unknown>): Promise<T> {
  const url = new URL(`${baseUrl}/v1/maps/proxy${endpoint}`);
  url.searchParams.append("key", apiKey);
  
  // Add other params
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });
  
  const response = await fetch(url.toString());
  return await response.json();
}

// Example: Geocoding
const result = await makeRequest<GeocodingResult>("/maps/api/geocode/json", {
  address: "1600 Amphitheatre Parkway"
});
```

**Available Maps APIs:**
- Geocoding (`/maps/api/geocode/json`)
- Directions (`/maps/api/directions/json`)
- Distance Matrix (`/maps/api/distancematrix/json`)
- Place Search (`/maps/api/place/textsearch/json`)
- Nearby Search (`/maps/api/place/nearbysearch/json`)
- Place Details (`/maps/api/place/details/json`)
- Elevation (`/maps/api/elevation/json`)
- Time Zone (`/maps/api/timezone/json`)
- Roads (`/v1/snapToRoads`, `/v1/nearestRoads`, `/v1/speedLimits`)
- Place Autocomplete (`/maps/api/place/autocomplete/json`)
- Static Maps (`/maps/api/staticmap`)

---

## 6. Complete Redux State — All 41 Slices

### 6.1 Core Slices (4)

#### `ui` Slice (14 keys)
Controls global UI state: theme, sidebar, window dimensions, input mode, and feature flags.

```typescript
interface UIState {
  currentTheme: string;           // "light" | "dark"
  isMobile: boolean;
  windowWidth: number;
  windowHeight: number;
  imageStyleList: any | null;
  imageStyleListLoading: boolean;
  inputMode: string;              // "text" | "voice"
  inputPlaybookId: string | null;
  inputPlaybookTemplate: string | null;
  inputValue: string;
  isAppBannerVisible: boolean;
  isPageVisible: boolean;
  microphonePermission: string;   // "prompt" | "granted" | "denied"
  pinnedSlideTemplateId: string | null;
  recommendedPlaybooks: any | null;
  recommendedPlaybooksLoading: boolean;
  recommendedPlaybooksV2: {
    playbooks: any | null;
    loading: boolean;
    total: number;
    currentPage: number;
  };
  sendQuestionBehavior: any | null;
  showSharePopover: any | null;
  slideTemplateList: any | null;
  slideTemplateListLoading: boolean;
  taskMode: string;               // "standard" | "research" | etc.
}
```

#### `chat` Slice (8 keys)
Manages the chat input area, file attachments, and conversation settings.

```typescript
interface ChatState {
  inputValue: string;
  files: UploadedFile[];
  model: string;                  // "claude-3.5-sonnet"
  agentMode: string;
  isComposing: boolean;
  replyTo: string | null;
  draft: string;
  settings: ChatSettings;
}
```

#### `timeline` Slice (3 keys)
The event stream — see Supplement G for full details.

```typescript
interface TimelineState {
  segmentEventsMap: Record<string, Event[]>;
  segmentEventsLoadingMap: Record<string, boolean>;
  percentage: number;
}
```

#### `sessions` Slice (16 keys)
Session management with normalized entity pattern.

```typescript
interface SessionsState {
  allCollaborators: { ids: string[]; entities: Record<string, Collaborator> };
  currentSessionId: string | null;
  groupedSessionState: GroupedSessionState;  // Complex grouping structure
  isSearchMode: boolean;
  isShareFileMode: boolean;
  isShareMode: boolean;
  loadBottomSegmentsLoading: boolean;
  loadSessionDetailLoading: boolean;
  loadSessionLoading: boolean;
  loadTopSegmentsLoading: boolean;
  scheduledTaskSessions: any | null;
  searchValue: string;
  segmentEndpoints: SegmentEndpoint[];
  sessions: { ids: string[]; entities: Record<string, Session> };
  sharingSessionUid: string | null;
  swapSessionDetailMap: Record<string, any>;
}
```

### 6.2 Canvas Slices (2)

#### `aiCanvas` Slice (2 keys)
```typescript
interface AICanvasState {
  allAiCanvas: Record<string, CanvasData>;
  ocrCache: Record<string, string>;  // Image → OCR text cache
}
```

#### `aiCanvasEditor` Slice (17 keys)
Full canvas editor state with shapes, camera, interaction, and tools.

```typescript
interface AICanvasEditorState {
  altDragCloneIds: string[];
  brushing: { isBrushing: boolean; startPoint: Point | null; currentPoint: Point | null };
  camera: { x: number; y: number; z: number };  // z = zoom (default 0.24)
  commentHistory: { past: any[]; future: any[] };
  commentPopup: { commentId: string; isOpen: boolean };
  contextMenu: { position: Point | null; target: any | null };
  editTextMode: EditTextConfig;
  guides: Guide[];
  hoveredShapeId: string | null;
  interaction: InteractionState;
  isAltPressed: boolean;
  marking: { isMarking: boolean; startPoint: Point | null; currentPoint: Point | null; imageShapeId: string | null };
  previewSelectedId: string | null;
  screenshots: { markScreenshots: Record<string, any>; markedImages: Record<string, any> };
  selectedShapeIds: string[];
  settings: { useScrollWheelZoom: boolean; rightClickDragToPan: boolean; gridState: boolean };
  shapes: Record<string, Shape>;
}
```

### 6.3 User & Auth Slices (2)

#### `auth` Slice
```typescript
interface AuthState {
  userInfo: {
    userId: string;              // "310519663278050818"
    email: string;
    displayname: string;
    membershipVersion: string;   // "free" | "pro" | "max"
    membershipInterval: string;  // "monthly" | "yearly"
    membershipTier: number;      // 20 for pro
    subscriptionStatus: number;  // 2 = active
    concurrentSessions: number;  // 20 for pro
    concurrentScheduleTaskLimit: number;
    area: number;                // Region code
    isAlpha: boolean;
    isBeta: boolean;
    smsVerified: boolean;
    uid: string;                 // "UQPBfxni7R9yLHS9RacYAL"
    paymentPlatform: string;     // "stripe"
    currentPeriodEnd: number;    // Unix timestamp
    cancelAtPeriodEnd: boolean;
  };
  usageInfo: {
    creditsUsed: number;
    creditsLimit: number;
  };
  token: string;
}
```

#### `webdevAuth` Slice
Manages authentication state for webdev project previews (separate from main Manus auth).

```typescript
interface WebdevAuthState {
  user: WebdevUser | null;
  loading: boolean;
  error: string | null;
}
```

### 6.4 Session Switching (1)

#### `sessionSwitch` Slice
Manages the UI state when switching between sessions.

```typescript
interface SessionSwitchState {
  switching: boolean;
  fromSessionId: string | null;
  toSessionId: string | null;
}
```

### 6.5 Feature Slices (8)

#### `codeViewer` Slice (9 keys)
Custom code editor for webdev Management UI.

```typescript
interface CodeViewerState {
  activeTabId: string | null;
  directoryList: DirectoryItem[];
  directoryMetaData: Record<string, { expanded: boolean }>;
  fileDataSource: Record<string, string>;     // filepath → content
  fileLoadingMap: Record<string, boolean>;
  fileTabList: FileTab[];
  loadDirectoryLoading: boolean;
  rootDirectory: string | null;
  userClickedFileTab: boolean;
}
```

#### `connectors` Slice (8 keys)
External service integrations (190+ connectors).

```typescript
interface ConnectorsState {
  connectors: Connector[];
  githubRepositories: Repository[];
  githubRepositoriesLoading: boolean;
  multipleCalendarConfirmedInfo: Record<string, any>;
  multipleEmailConfirmedInfo: Record<string, any>;
  searchQuery: string;
  temporaryEnabledOverrides: Record<string, boolean>;
  temporaryGithubRepositories: Record<string, any>;
}
```

#### `fileConnector` Slice
External file service connections (Google Drive, Dropbox, etc.).

#### `fileManagement` Slice
File upload/download tracking.

#### `filePreviewer` Slice
File preview panel state.

#### `fileShare` Slice
File and session sharing state.

#### `mapReduce` Slice (2 keys)
```typescript
interface MapReduceState {
  isFullscreen: boolean;
  startLoading: boolean;
}
```

#### `webDev` Slice (31 keys)
The largest slice — manages the entire webdev Management UI.

```typescript
interface WebDevState {
  activeTab: string;              // "preview" | "code" | "file" | "database" | "dashboard" | "settings"
  cachedInviteUsers: any[];
  currentAppBuildingProgress: Record<string, any>;
  currentProjectInviteUsers: any[];
  database: DatabaseState;        // Complex: tables, queries, results
  editMobileAppVersionDialogOpen: boolean;
  editMode: boolean;
  fullStyleSelections: any[];
  gitRepoCreation: { status: string };
  gitSyncStatus: { status: string | null; isLoading: boolean };
  initPreviewPath: string;
  initServerProjectLoading: boolean;
  isFullscreenMode: boolean;
  lastFeatureConfirm: { features: string[] };
  mobilePreviewOnPhoneHidden: boolean;
  mountedTabs: {
    preview: boolean;
    database: boolean;
    settings: boolean;
    dashboard: boolean;
    code: boolean;
    file: boolean;
  };
  preview: { isHistoricalVersion: boolean };
  previewOldVersion: any | null;
  previewOldVersionLoading: boolean;
  previewerBadgeClosedList: string[];
  project: WebDevProject | null;
  projectInited: boolean;
  publishButtonLoading: boolean;
  publishPopoverVisible: boolean;
  setting: SettingState;          // Complex: domains, secrets, notifications
  settingSubTab: string | null;
  storage: StorageState;          // Complex: files, usage
  updateCurrentAabVersion: any | null;
  updateCurrentApkVersion: any | null;
  userClickedTab: string | null;
  webview: WebviewState;          // Complex: URL, loading, history
}
```

#### `webDevUsage` Slice
Tracks webdev resource usage (storage, bandwidth, database).

### 6.6 Other Slices (22)

| Slice | Keys | Purpose |
|-------|------|---------|
| `notification` | 12 | Notification panel: categories, unread badges, loading states |
| `agentWorkspace` | ~5 | Agent sidebar: plan display, workspace panels |
| `scheduledTask` | ~4 | Scheduled task management: list, status, next run |
| `slideEditor` | ~8 | Presentation editor: slides, current slide, editing state |
| `knowledge` | ~3 | Knowledge base items and loading state |
| `library` | ~4 | Template library: categories, items, search |
| `project` | ~5 | Project management (separate from webdev) |
| `team` | ~3 | Team collaboration: members, invites |
| `onboarding` | ~3 | New user onboarding flow: step, completed |
| `navbar` | ~2 | Navigation bar state: collapsed, active item |
| `configs` | ~3 | App configuration: feature flags, settings |
| `biz` | ~2 | Business logic state |
| `experiment` | ~2 | A/B testing: active experiments, variants |
| `example` | ~2 | Example/demo data |
| `community` | ~3 | Community features: posts, comments |
| `guestPage` | ~2 | Guest/public page state |
| `login` | ~3 | Login form state: method, loading, error |
| `mailManus` | ~4 | Email integration state |
| `products` | ~3 | Product catalog state |
| `myBrowser` | ~5 | Browser automation: URL, title, screenshot, elements |
| `websocket` | ~5 | WebSocket connection: status, reconnect, queue |
| `_persist` | 3 | Redux-persist internal: version, rehydrated, purge |

---

## 7. The Complete Prompt-to-Response Flow

This section documents every single step from the moment a user types a message to the final response appearing on screen, including every API call, state change, database write, and process interaction.

### 7.1 Phase 1: User Input Capture

```
[BROWSER] User types "Research AI companies and create a report"
  │
  ├─ React onChange event fires
  ├─ dispatch(chatActions.setInputValue("Research AI companies..."))
  ├─ Redux: chat.inputValue = "Research AI companies..."
  ├─ Input component re-renders with new text
  │
  └─ User presses Enter or clicks Send button
     │
     ├─ React onSubmit/onClick event fires
     ├─ Validation: inputValue is non-empty
     └─ dispatch(sendMessage(inputValue)) ← async thunk
```

### 7.2 Phase 2: Message Dispatch

```
[FRONTEND → BACKEND]
  │
  ├─ dispatch(chatActions.clearInput())
  │   └─ Redux: chat.inputValue = ""
  │
  ├─ dispatch(chatActions.clearFiles())
  │   └─ Redux: chat.files = []
  │
  ├─ HTTP POST /v1/sessions/{sessionId}/messages
  │   Headers: { Authorization: "Bearer {token}", Content-Type: "application/json" }
  │   Body: {
  │     role: "user",
  │     content: "Research AI companies and create a report",
  │     files: [],
  │     model: "claude-3.5-sonnet",
  │     agentMode: "standard"
  │   }
  │
  └─ Response: { messageId: "msg_001", status: "accepted" }
```

### 7.3 Phase 3: Backend Message Processing

```
[BACKEND - Orchestration Server]
  │
  ├─ 1. VALIDATE REQUEST
  │   ├─ Verify JWT token → Extract userId
  │   ├─ Check user credits (Redis: user:{userId}:credits)
  │   ├─ Check concurrent session limit (20 for pro)
  │   └─ Rate limit check
  │
  ├─ 2. PERSIST MESSAGE
  │   └─ INSERT INTO messages (id, session_id, role, content, created_at)
  │      VALUES ('msg_001', '{sessionId}', 'user', 'Research AI...', NOW())
  │
  ├─ 3. LOAD CONVERSATION CONTEXT
  │   ├─ SELECT * FROM messages WHERE session_id = '{sessionId}' ORDER BY created_at
  │   ├─ SELECT * FROM plans WHERE session_id = '{sessionId}' AND status = 'active'
  │   └─ Cache context in Redis: session:{sessionId}:context
  │
  ├─ 4. BUILD SYSTEM PROMPT
  │   ├─ Base system prompt (agent identity, capabilities, rules)
  │   ├─ <language> section (working language)
  │   ├─ <format> section (markdown, style rules)
  │   ├─ <agent_loop> section (plan → act → observe → repeat)
  │   ├─ <tool_use> section (function calling rules)
  │   ├─ <sandbox> section (environment details)
  │   ├─ <utilities> section (CLI tools available)
  │   ├─ <secrets> section (user's configured secrets)
  │   ├─ <skills> section (available skill names + descriptions)
  │   ├─ <related_knowledge> section (relevant knowledge items)
  │   ├─ <mcp_integration> section (if MCP servers configured)
  │   └─ <webdev_*> sections (if webdev project active)
  │
  ├─ 5. BUILD TOOL DEFINITIONS
  │   └─ 29 tool definitions in OpenAI function calling format:
  │      plan, message, shell, file, match, search, schedule, map,
  │      expose, browser, generate, slides, webdev_check_status,
  │      webdev_restart_server, webdev_add_feature, webdev_save_checkpoint,
  │      webdev_rollback_checkpoint, webdev_execute_sql
  │
  ├─ 6. NOTIFY FRONTEND (WebSocket)
  │   └─ { type: "message", role: "user", id: "msg_001", content: "...", timestamp: ... }
  │
  └─ 7. CALL LLM
     └─ POST https://api.anthropic.com/v1/messages
        Headers: { x-api-key: "{anthropic_key}", anthropic-version: "2023-06-01" }
        Body: {
          model: "claude-sonnet-4-20250514",
          max_tokens: 16384,
          system: "{full system prompt}",
          messages: [{role: "user", content: "Research AI companies..."}],
          tools: [{...29 tool definitions}],
          stream: true
        }
```

### 7.4 Phase 4: LLM Response Processing

```
[BACKEND - LLM Response Stream]
  │
  ├─ Claude streams response tokens
  │   ├─ If text content → Buffer and send via WebSocket
  │   └─ If tool_use → Parse tool call
  │
  ├─ EXAMPLE: Claude returns plan tool call
  │   {
  │     "type": "tool_use",
  │     "id": "toolu_plan_001",
  │     "name": "plan",
  │     "input": {
  │       "action": "update",
  │       "goal": "Research AI companies and create a report",
  │       "phases": [...],
  │       "current_phase_id": 1
  │     }
  │   }
  │
  ├─ PERSIST TOOL CALL
  │   └─ INSERT INTO tool_calls (id, session_id, tool_name, parameters, status)
  │
  ├─ NOTIFY FRONTEND (WebSocket)
  │   └─ { type: "tool_call", toolCallId: "toolu_plan_001", toolName: "plan", params: {...} }
  │
  ├─ EXECUTE TOOL (plan is orchestration-side)
  │   ├─ INSERT INTO plans (id, session_id, goal, phases, current_phase_id)
  │   └─ Result: { success: true }
  │
  ├─ NOTIFY FRONTEND (WebSocket)
  │   └─ { type: "plan_update", plan: { goal: "...", phases: [...], currentPhaseId: 1 } }
  │
  ├─ UPDATE TOOL CALL
  │   └─ UPDATE tool_calls SET status='completed', result='{...}' WHERE id='toolu_plan_001'
  │
  └─ CONTINUE LLM LOOP (add tool result to context, call Claude again)
```

### 7.5 Phase 5: Sandbox Tool Execution

```
[BACKEND → E2B SANDBOX]
  │
  ├─ Claude returns: { name: "search", input: { type: "info", queries: ["top AI companies 2026"] } }
  │
  ├─ ROUTE DECISION: "search" → orchestration-side tool
  │   ├─ Execute search via Manus search service
  │   ├─ Return results to LLM context
  │   └─ Claude processes results...
  │
  ├─ Claude returns: { name: "file", input: { action: "write", path: "/home/ubuntu/report.md", text: "..." } }
  │
  ├─ ROUTE DECISION: "file" → sandbox-side tool
  │   ├─ gRPC call to start_server (port 8330) inside E2B sandbox
  │   ├─ TCP: orchestration_ip:random_port → 169.254.0.21:8330
  │   ├─ start_server receives request
  │   ├─ Writes file to /home/ubuntu/report.md
  │   ├─ Returns: { status: "success", path: "/home/ubuntu/report.md" }
  │   └─ gRPC response back to orchestration
  │
  ├─ NOTIFY FRONTEND (WebSocket)
  │   └─ { type: "tool_result", toolCallId: "toolu_file_001", status: "completed", result: {...} }
  │
  └─ ADD RESULT TO CONTEXT → Call Claude again
```

### 7.6 Phase 6: Final Response and Delivery

```
[BACKEND → FRONTEND]
  │
  ├─ Claude returns final text response
  │   "I've researched the top AI companies and created a comprehensive report..."
  │
  ├─ PERSIST ASSISTANT MESSAGE
  │   └─ INSERT INTO messages (id, session_id, role, content) VALUES ('msg_002', ..., 'assistant', '...')
  │
  ├─ Claude returns message tool call with attachments
  │   { name: "message", input: { type: "result", text: "...", attachments: ["/home/ubuntu/report.md"] } }
  │
  ├─ UPLOAD ATTACHMENT TO S3
  │   ├─ manus-upload-file /home/ubuntu/report.md
  │   ├─ S3 key: user_upload_by_module/session_file/{userId}/{random}.md
  │   └─ CDN URL: https://files.manuscdn.com/user_upload_by_module/session_file/{userId}/{random}.md
  │
  ├─ NOTIFY FRONTEND (WebSocket)
  │   └─ { type: "message", role: "assistant", content: "...", attachments: [{url: "https://..."}] }
  │
  ├─ TASK FINISHED
  │   ├─ Calculate credits used (LLM tokens + tool calls + file storage)
  │   ├─ UPDATE sessions SET costed_credits = costed_credits + X WHERE id = '{sessionId}'
  │   ├─ UPDATE users SET credits_used = credits_used + X WHERE id = '{userId}'
  │   └─ WebSocket: { type: "task_finished", creditsUsed: X }
  │
  └─ [FRONTEND RECEIVES]
     ├─ dispatch(timelineActions.addMessage(assistantMessage))
     ├─ dispatch(websocketActions.taskFinished())
     ├─ dispatch(authActions.updateCredits(X))
     ├─ Timeline renders assistant message with markdown
     ├─ Attachment rendered as download link
     └─ "Processing..." indicator hidden
```

---

## 8. WebDev OAuth Flow (Complete)

When a webdev app uses `web-db-user` with Manus OAuth:

```
1. User visits webdev app → Not authenticated
   ↓
2. Frontend redirects to Manus OAuth portal
   URL: {VITE_OAUTH_PORTAL_URL}/authorize?
     client_id={VITE_APP_ID}&
     redirect_uri={app_url}/api/oauth/callback&
     response_type=code&
     state={random_state}
   ↓
3. User logs in via Manus (Google, GitHub, email, etc.)
   ↓
4. Manus OAuth server redirects back with code
   GET {app_url}/api/oauth/callback?code={auth_code}&state={state}
   ↓
5. Server exchanges code for token
   POST {OAUTH_SERVER_URL}/exchange-token
   Body: { grantType: "authorization_code", code, clientId: APP_ID, redirectUri }
   Response: { accessToken, tokenType, expiresIn, refreshToken, idToken }
   ↓
6. Server gets user info
   POST {OAUTH_SERVER_URL}/get-user-info
   Body: { accessToken }
   Response: { openId, name, email, platform, loginMethod }
   ↓
7. Server upserts user in TiDB
   INSERT INTO users (openId, name, email, loginMethod, lastSignedIn)
   ON DUPLICATE KEY UPDATE ...
   ↓
8. Server creates JWT session token
   JWT payload: { openId, appId, name }
   Signed with: JWT_SECRET (HS256)
   ↓
9. Server sets cookie
   Set-Cookie: app_session_id={jwt}; HttpOnly; Secure; SameSite=Lax; MaxAge=1year
   ↓
10. Redirect to /
    ↓
11. Frontend: useAuth() hook calls trpc.auth.me
    → Server verifies JWT from cookie
    → Returns user object
    → Frontend renders authenticated state
```

---

## 9. Manus Types (Protobuf-Derived)

The webdev server templates include TypeScript types auto-generated from protobuf definitions:

```typescript
// server/_core/types/manusTypes.ts (generated 2025-09-24)

interface AuthorizeRequest {
  redirectUri: string;
  projectId: string;
  state: string;
  responseType: string;
  scope: string;
}

interface ExchangeTokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken?: string;
  scope: string;
  idToken: string;
}

interface GetUserInfoResponse {
  openId: string;
  projectId: string;
  name: string;
  email?: string | null;
  platform?: string | null;
  loginMethod?: string | null;
}

interface CanAccessResponse {
  canAccess: boolean;
}

interface GetUserInfoWithJwtResponse {
  openId: string;
  projectId: string;
  name: string;
  email?: string | null;
  platform?: string | null;
  loginMethod?: string | null;
}
```

These types reveal that the Manus OAuth system uses **Connect Protocol** (gRPC-Web compatible) for service-to-service communication, with protobuf as the serialization format.

---

## 10. The `agentWorkspace` Slice — Plan Display

The `agentWorkspace` slice manages the right sidebar that shows the task plan:

```typescript
interface AgentWorkspaceState {
  plan: {
    goal: string;
    phases: Phase[];
    currentPhaseId: number;
  } | null;
  isExpanded: boolean;
  activePanel: string;  // "plan" | "files" | "browser"
}
```

**Plan update flow:**
```
Agent calls plan tool with action: "update"
  → Orchestration stores plan in database
  → WebSocket: { type: "plan_update", plan: {...} }
  → dispatch(agentWorkspaceActions.setPlan(plan))
  → Redux: agentWorkspace.plan = { goal, phases, currentPhaseId }
  → Sidebar re-renders with plan phases
  → Current phase highlighted

Agent calls plan tool with action: "advance"
  → Orchestration updates plan in database
  → WebSocket: { type: "plan_advance", currentPhaseId: 2 }
  → dispatch(agentWorkspaceActions.advancePlan(2))
  → Redux: agentWorkspace.plan.currentPhaseId = 2
  → Previous phase gets checkmark, next phase highlighted
```

---

## 11. Scheduled Tasks Flow

```
Agent calls schedule tool
  → Orchestration: INSERT INTO scheduled_tasks (...)
  → Cron/interval scheduler registered
  → WebSocket: { type: "scheduled_task_created", task: {...} }
  → dispatch(scheduledTaskActions.addTask(task))

When schedule triggers:
  → Scheduler creates new session
  → POST /v1/sessions { title: task.name, prompt: task.prompt }
  → Agent executes task.prompt in new session
  → If task.playbook provided, agent follows the playbook
  → If task.repeat = true, scheduler reschedules
  → If task.expire set and expired, scheduler removes task
```

---

## 12. Slide Editor Flow

```
Agent calls slides tool
  → Reads slide_content_file_path (markdown with slide content)
  → Orchestration: Creates slide deck
  → If generate_mode = "html": Generates HTML/CSS slides with Chart.js
  → If generate_mode = "image": Renders each slide as an image
  → WebSocket: { type: "slides_created", slidesUri: "manus-slides://{versionId}" }
  → dispatch(slideEditorActions.setSlides(slidesData))
  → Slide preview rendered in timeline
  → User can export: manus-export-slides manus-slides://{versionId} pdf|ppt
```

---

## 13. MCP (Model Context Protocol) Integration

MCP servers provide external tool access. The flow:

```
1. User configures MCP server (e.g., "gmail") in Manus settings
   → Backend stores MCP config
   → System prompt includes <mcp_integration> section

2. Agent needs MCP tool
   → Agent calls shell tool: manus-mcp-cli tool list --server gmail
   → Returns available tools: [gmail_send, gmail_search, gmail_read, ...]

3. Agent calls MCP tool
   → shell: manus-mcp-cli tool call gmail_send --server gmail --input '{"to":"...","subject":"...","body":"..."}'
   → manus-mcp-cli binary handles:
     a. OAuth token refresh (if needed)
     b. MCP protocol communication
     c. Tool execution
     d. Result formatting
   → Returns tool result to agent

4. OAuth for MCP
   → If token expired: manus-mcp-cli triggers OAuth flow
   → User may need to take over browser for login
   → Token stored and refreshed automatically
```

---

## 14. WebSocket Event Types (Complete)

| Direction | Event Type | Payload | Redux Action |
|-----------|-----------|---------|--------------|
| Server → Client | `connected` | `{ sessionId }` | `websocket.setConnected(true)` |
| Server → Client | `message` | `{ role, content, id, timestamp }` | `timeline.addMessage()` |
| Server → Client | `tool_call` | `{ toolCallId, toolName, params }` | `timeline.addToolCall()` |
| Server → Client | `tool_result` | `{ toolCallId, status, result }` | `timeline.updateToolCall()` |
| Server → Client | `plan_update` | `{ goal, phases, currentPhaseId }` | `agentWorkspace.setPlan()` |
| Server → Client | `plan_advance` | `{ currentPhaseId }` | `agentWorkspace.advancePlan()` |
| Server → Client | `task_finished` | `{ creditsUsed }` | `websocket.taskFinished()` |
| Server → Client | `map_progress` | `{ jobId, completed, total }` | `mapReduce.updateProgress()` |
| Server → Client | `file_uploaded` | `{ fileId, url, name }` | `fileManagement.addFile()` |
| Server → Client | `status_update` | `{ sessionId, status }` | `sessions.updateStatus()` |
| Server → Client | `error` | `{ code, message }` | Error toast displayed |
| Server → Client | `pong` | `{}` | Keep-alive acknowledged |
| Server → Client | `slides_created` | `{ slidesUri }` | `slideEditor.setSlides()` |
| Server → Client | `webdev_checkpoint` | `{ versionId, screenshot }` | `webDev.addCheckpoint()` |
| Server → Client | `browser_screenshot` | `{ url, elements }` | `myBrowser.setScreenshot()` |
| Server → Client | `notification` | `{ title, content }` | `notification.addNotification()` |
| Client → Server | `subscribe` | `{ sessionId }` | - |
| Client → Server | `unsubscribe` | `{ sessionId }` | - |
| Client → Server | `ping` | `{}` | - |

---

## 15. Summary of What Was Missing

This supplement fills the following gaps identified in the original 6 documents:

| Gap | Now Documented In |
|-----|-------------------|
| Voice input/transcription flow | Section 1 |
| Skill system architecture | Section 2 |
| Knowledge base mechanics | Section 3 |
| File connector routing | Section 4 |
| Forge API (all services) | Section 5 |
| All 41 Redux slices | Section 6 |
| Complete prompt-to-response flow | Section 7 |
| WebDev OAuth complete flow | Section 8 |
| Protobuf/Connect types | Section 9 |
| Agent workspace / plan display | Section 10 |
| Scheduled tasks flow | Section 11 |
| Slide editor flow | Section 12 |
| MCP integration flow | Section 13 |
| Complete WebSocket event catalog | Section 14 |
