# Manus IDE Deep Dive: How It Works, State Connections, and AI SDK Replication

## 1. How the IDE is Displayed: THREE Different IDEs

Manus uses **three distinct IDE/code viewing modes**, depending on the context:

### Mode 1: The Lightweight Canvas Code Viewer

This is the most common view. It appears in the right-side canvas panel when the agent performs file operations (`file_read`, `file_write`) during general tasks. It is a **custom-built React component** that uses a library like **Monaco Editor** (the engine that powers VS Code) to render the code.

- **Triggered by**: `agentWorkspace.sidebarType` being set to `"code"` or `"filePreviewer"`.
- **Features**: File tree sidebar, tabbed interface for open files, syntax highlighting, line numbers.
- **State Slice**: Primarily driven by the **`codeViewer`** slice.

### Mode 2: The Full Web Dev IDE

This is a full-featured, multi-tabbed IDE that appears when you are working on a **web development project**. It includes tabs for Preview, Database, Storage, Settings, and Code.

- **Triggered by**: Being inside a web development project.
- **Features**: Live preview, database table editor, file storage browser, project settings, and a full code editor.
- **State Slice**: Driven by the **`webDev`** slice.

### Mode 3: The REAL Embedded VS Code (code-server)

This is the most powerful mode. Manus runs a full instance of **`code-server`** (VS Code in the browser) inside the E2B sandbox. The `webDev` IDE likely **embeds this `code-server` instance in an `<iframe>`** within its "Code" tab.

- **Triggered by**: The `sandboxUpdate` WebSocket event, which provides a `codeServerUrl`.
- **Features**: The complete VS Code experience — extensions, terminal, debugger, Git, etc.
- **State Slice**: The URL is provided by the `websocket` slice, but the IDE itself runs independently inside the iframe.

---

## 2. How the Canvas Code Viewer Works: The `codeViewer` Slice

The lightweight canvas IDE is controlled entirely by the `codeViewer` slice. Here is how its state maps to the UI:

| `codeViewer` Property | Type | What It Controls |
|---|---|---|
| `directoryList` | `array` | The file tree sidebar. Each object has `id`, `name`, `type` (`file` or `directory`), `path`, `depth`. |
| `directoryMetaData` | `object` | The expanded/collapsed state of folders in the file tree. e.g., `{ "client/": { "expanded": true } }` |
| `fileTabList` | `array` | The list of open file tabs at the top of the editor. Each object has `id`, `name`, `path`. |
| `activeTabId` | `string` | The `id` of the currently visible tab. |
| `fileDataSource` | `object` | A map where keys are file paths and values are the file content as a string. **This holds the actual code.** |
| `fileLoadingMap` | `object` | Maps file paths to a boolean, showing a loading spinner for individual files. |
| `loadDirectoryLoading` | `boolean` | Shows a loading spinner for the entire file tree. |

### The Data Flow

1.  **Agent calls `file_read` or `file_write` tool.**
2.  A `toolUsed` WebSocket event is emitted with `tool: "text_editor"`.
3.  The event `detail` contains `{ textEditor: { action, path, content } }`.
4.  The Redux reducer for `codeViewer` listens for this event:
    -   It updates `fileDataSource[path]` with the new `content`.
    -   It adds a new tab to `fileTabList` if it doesn’t exist.
    -   It sets `activeTabId` to the path of the new file.
5.  Simultaneously, the `agentWorkspace` reducer sets `sidebarType` to `"code"`.
6.  The `ManusCanvas` component sees `sidebarType === "code"` and renders the `CodeIDEView`.
7.  The `CodeIDEView` component uses `useSelector` to get all the data from the `codeViewer` slice and renders the file tree, tabs, and the Monaco Editor with the active file content.

---

## 3. JSX Implementation with AI SDK

With the AI SDK, you don’t need Redux. The state is derived directly from the `messages` array provided by `useChat()`.

### The `useIDEState` Hook

This hook is the replacement for the `codeViewer` slice. It iterates through the `messages` array and builds the IDE state on the fly.

```typescript
// app/hooks/useIDEState.ts
import { useMemo } from 'react';
import { type Message } from 'ai';

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  depth: number;
}

export function useIDEState(messages: Message[]) {
  return useMemo(() => {
    const fileDataSource: Record<string, string> = {};
    const fileTree: FileTreeNode[] = [];
    const openTabs: { id: string; name: string; path: string }[] = [];
    const directoryMeta: Record<string, { expanded: boolean }> = {};

    const allPaths = new Set<string>();

    // Process messages to build the file system state
    for (const message of messages) {
      if (message.role !== 'tool' || !message.content) continue;

      try {
        const toolData = JSON.parse(message.content);
        if (toolData.tool === 'file_write' || toolData.tool === 'file_read') {
          const { path, content } = toolData.result;
          fileDataSource[path] = content;
          if (!openTabs.some(t => t.path === path)) {
            openTabs.push({ id: path, name: path.split('/').pop() || path, path });
          }
          allPaths.add(path);
        }
      } catch (e) {}
    }

    // Build the file tree from all known paths
    const sortedPaths = Array.from(allPaths).sort();
    const addedDirs = new Set<string>();

    for (const path of sortedPaths) {
      const parts = path.split('/').filter(p => p);
      let currentPath = '';
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLastPart = i === parts.length - 1;
        const nodePath = (currentPath ? currentPath + '/' : '') + part;
        const nodeType = isLastPart ? 'file' : 'directory';

        if (nodeType === 'directory') {
          if (!addedDirs.has(nodePath)) {
            fileTree.push({ id: nodePath, name: part, path: nodePath, type: 'directory', depth: i });
            addedDirs.add(nodePath);
            directoryMeta[nodePath + '/'] = { expanded: true }; // Auto-expand by default
          }
        } else {
          fileTree.push({ id: nodePath, name: part, path: nodePath, type: 'file', depth: i });
        }
        currentPath = nodePath;
      }
    }

    const activeTabId = openTabs.length > 0 ? openTabs[openTabs.length - 1].id : null;

    return { fileDataSource, fileTree, openTabs, activeTabId, directoryMeta };
  }, [messages]);
}
```

### The `CodeIDEView` Component

This component takes the state from the hook and renders the IDE layout using `@monaco-editor/react`.

```tsx
// app/components/CodeIDEView.tsx
import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { FileTreeNode } from '../hooks/useIDEState';
import { File, Folder, FolderOpen } from 'lucide-react';

// ... (props interface for fileDataSource, fileTree, etc.)

export function CodeIDEView({ fileDataSource, fileTree, openTabs, activeTabId: initialActiveTabId }) {
  const [activeTab, setActiveTab] = useState(initialActiveTabId);

  const activeFileContent = activeTab ? fileDataSource[activeTab] : '// Select a file to view its content';

  return (
    <div className="flex h-full bg-[#0d0d1a]">
      {/* File Tree Sidebar */}
      <div className="w-1/3 max-w-xs bg-[#12121e] p-2 overflow-y-auto">
        <h3 className="font-semibold text-sm mb-2 px-2">Explorer</h3>
        {fileTree.map(node => (
          <div 
            key={node.id} 
            className="flex items-center gap-2 p-1 rounded-md hover:bg-white/10 cursor-pointer"
            style={{ paddingLeft: `${node.depth * 1 + 0.5}rem` }}
            onClick={() => node.type === 'file' && setActiveTab(node.path)}
          >
            {node.type === 'directory' ? <FolderOpen size={16} /> : <File size={16} />}
            <span className="text-sm truncate">{node.name}</span>
          </div>
        ))}
      </div>

      {/* Editor Pane */}
      <div className="flex-1 flex flex-col">
        {/* Tabs */}
        <div className="flex-shrink-0 flex bg-[#12121e]">
          {openTabs.map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm border-t-2 ${activeTab === tab.id ? 'bg-[#0d0d1a] border-blue-500' : 'border-transparent text-gray-400'}`}>
              {tab.name}
            </button>
          ))}
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 bg-[#1e1e1e]">
          <Editor
            height="100%"
            language="typescript" // Or derive from file extension
            theme="vs-dark"
            value={activeFileContent}
            options={{ readOnly: true, minimap: { enabled: false } }}
          />
        </div>
      </div>
    </div>
  );
}
```

### Integrating into the Canvas

Finally, the `ManusCanvas` component would use the `useIDEState` hook and render the `CodeIDEView` when the active view is `"CodeIDE"`.

```tsx
// app/components/ManusCanvas.tsx
// ... (imports)
import { useIDEState } from '../hooks/useIDEState';
import { CodeIDEView } from './CodeIDEView';

export function ManusCanvas({ messages, activeView }) {
  const ideState = useIDEState(messages);

  // ... (other view logic)

  if (activeView === 'CodeIDE') {
    return <CodeIDEView {...ideState} activeTabId={ideState.activeTabId} />;
  }

  // ... (return other views)
}
```
