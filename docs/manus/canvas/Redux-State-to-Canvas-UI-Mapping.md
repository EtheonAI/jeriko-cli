# Redux State to Canvas UI Mapping

This document provides a precise mapping of which Redux state slices and properties control each part of the `ManusCanvas` component. The connection is made through `react-redux` selectors, which pull data from the global state and pass it as props to the UI component.

## Core Principle: State-Driven UI

The Manus UI follows a strict state-driven pattern. The agent and backend systems update the Redux state, and the React components reactively render based on that state. The canvas does not have its own logic; it is a pure reflection of the data in the Redux store.

## Canvas View Type (`viewType` prop)

The most important prop, `viewType`, which determines which of the 9 views to show (Browser, Code IDE, etc.), is primarily derived from the `agentWorkspace.sidebarType` state and the most recent tool call event in the `websocket` slice.

- **`agentWorkspace.sidebarType`**: This state is the primary driver. It can be explicitly set to values like `"browser"`, `"code_editor"`, `"file_previewer"`, etc.
- **`websocket` events**: If `sidebarType` is null, the UI infers the view from the most recent `toolUsed` event in the `websocket.entities` map. For example, a `shell_exec` tool call implies a `"terminal"` view.

## Detailed State-to-Prop Mapping

The following table breaks down the connection for each major view of the `ManusCanvas` component.

### Browser View

This view is activated when `agentWorkspace.sidebarType` is `"browser"` or when a browser tool is used. The live view itself is powered by a VNC connection, whose visibility is controlled by `agentWorkspace.vncDialogVisible`.

| `ManusCanvas` Prop | Redux State Slice & Property | Description |
|---|---|---|
| `viewType="browser"` | `agentWorkspace.sidebarType` or `websocket` event | Determines if the browser view is active. |
| `browserUrl` | `websocket` event (`toolUsed` payload) | The URL comes from the `args` of the `browser_navigate` tool call event. |
| `browserScreenshot` | `sessions.entities[sessionId].webpageScreenshots` | The Redux state stores screenshots of web pages keyed by session ID. The component would display the latest one. |
| `browserLoading` | `websocket` event (`toolUsed` state) | True if the latest browser tool call in the `websocket` stream has not yet received a result. |

### Code IDE View

This view is primarily driven by the **`codeViewer`** slice, which holds the entire state for the IDE-like experience.

| `ManusCanvas` Prop | Redux State Slice & Property | Description |
|---|---|---|
| `viewType="code"` | `agentWorkspace.sidebarType` | Set to `"code_editor"` to show this view. |
| `fileTree` | `codeViewer.directoryList` | The complete file and folder structure for the project explorer sidebar. |
| `fileTabs` | `codeViewer.fileTabList` | An array of objects representing the open tabs at the top of the editor. |
| `activeFileContent` | `codeViewer.fileDataSource[activeTabPath]` | The text content of the currently active file, looked up from the `fileDataSource` map using the path from the active tab. |
| `activeFileLanguage` | Inferred from file extension | The language for syntax highlighting is determined from the active file's name (e.g., `.tsx` -> `typescript`). |

### Terminal View

This view is not driven by a dedicated slice but is constructed from the history of `shell_exec` tool calls found in the `websocket` event stream.

| `ManusCanvas` Prop | Redux State Slice & Property | Description |
|---|---|---|
| `viewType="terminal"` | `websocket` event (`toolUsed` name) | Inferred when the last tool used was `shell_exec`, `shell_view`, etc. |
| `terminalOutput` | `websocket.entities` | The component would select all `toolUsed` events where the tool is `shell_exec`, then concatenate the `command` from the `args` and the `stdout`/`stderr` from the `result` to build a historical log. |

### File Preview View

This view is controlled by the **`filePreviewer`** slice, which manages the state of the file preview modal.

| `ManusCanvas` Prop | Redux State Slice & Property | Description |
|---|---|---|
| `viewType="filePreview"` | `agentWorkspace.sidebarType` | Set to `"file_previewer"` to activate this view. |
| `previewFileName` | `filePreviewer.previewData.displayFilename` | The name of the file being previewed. |
| `previewContent` | `filePreviewer.previewData.raw[0].fileContent` | The actual content of the file. |
| `previewFileType` | `filePreviewer.previewData.category` | The type of file (e.g., `"code"`, `"image"`, `"document"`) which determines how to render the content. |
| `isFullscreen` | `filePreviewer.fullscreen` | Controls whether the preview takes up the entire screen. |

### Slides View

This view is managed by the **`slideEditor`** slice.

| `ManusCanvas` Prop | Redux State Slice & Property | Description |
|---|---|---|
| `viewType="slides"` | `agentWorkspace.sidebarType` | Set to `"slide_editor"`. |
| `slides` | `slideEditor.slides` | An array containing the data for each slide in the presentation. |
| `currentSlideIndex` | `filePreviewer.currentSlideId` | The ID of the currently visible slide is tracked in the `filePreviewer` slice when in slide mode. |

### Web Dev IDE View

This is the most complex view, aggregating state from multiple tabs within the **`webDev`** slice.

| `ManusCanvas` Prop | Redux State Slice & Property | Description |
|---|---|---|
| `viewType="webDevIDE"` | `agentWorkspace.sidebarType` | Set to `"web_dev"`. |
| `(Internal activeTab)` | `webDev.activeTab` | Controls which sub-view is shown: Code, Database, Storage, or Settings. |
| `fileTree` | `codeViewer.directoryList` | The Web Dev IDE reuses the `codeViewer` slice for its file explorer. |
| `(Database Data)` | `webDev.database.tableList` & `tableData` | Holds the schema and row data for the database browser tab. |
| `(Storage Data)` | `webDev.storage.files` | Holds the file list for the cloud storage tab. |

### Shared Components (Header, Timeline, Status Bar)

These components are visible across most views and pull their data from a combination of slices.

| UI Element | Prop | Redux State Slice & Property | Description |
|---|---|---|---|
| **Header** | `currentAction` | `websocket.entities` (latest `toolUsed` event) | The action badge (e.g., "Clicking element") is generated from the name and args of the most recent tool call. |
| **Timeline** | `timelinePercentage` | `timeline.percentage` | The scrubber's position is directly controlled by the `percentage` property in the `timeline` slice. |
| **Status Bar** | `statusText`, `currentStep`, `totalSteps` | `websocket.entities` (latest `statusUpdate` event) | The text "Manus is working..." and the step counter are derived from the payload of the latest `statusUpdate` or `planUpdate` event. |
| 
| **Fullscreen** | `isFullscreen` | `agentWorkspace.isSidebarPreviewFullscreen` | The overall fullscreen state of the canvas is controlled by this boolean in the `agentWorkspace`. |
