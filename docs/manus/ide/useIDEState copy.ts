import { useMemo } from 'react';
import { type Message } from 'ai';

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  depth: number;
}

/**
 * A hook that derives the entire state of a virtual file system IDE
 * from the AI SDK's `messages` array. It scans all tool calls for
 * file operations and reconstructs the file tree, open tabs, and
 * file contents on the fly.
 */
export function useIDEState(messages: Message[]) {
  return useMemo(() => {
    const fileDataSource: Record<string, string> = {};
    const openTabs: { id: string; name: string; path: string }[] = [];
    const allPaths = new Set<string>();

    // 1. Process all messages to populate the file data source and identify all known paths.
    for (const message of messages) {
      if (message.role !== 'assistant') continue;

      for (const part of message.parts) {
        if (part.type !== 'tool-call') continue;

        const { toolName, args } = part;
        if (toolName === 'file_write' || toolName === 'file_read') {
          const path = args.path || args.file;
          if (typeof path !== 'string') continue;

          // For file_write, the content is in the arguments.
          // For file_read, the content is in the result (which we don't have here).
          // We will get the result content from the *next* message part (tool-result).
          if (toolName === 'file_write' && typeof args.content === 'string') {
            fileDataSource[path] = args.content;
          }
          allPaths.add(path);
        }
      }

      // Look for tool results to get content from file_read
      for (const part of message.parts) {
        if (part.type !== 'tool-result') continue;

        // This is a simplification. In a real app, you'd match toolCallId.
        // We'll assume the result corresponds to a previous file_read call.
        const { result } = part;
        if (result && typeof result.content === 'string' && typeof result.path === 'string') {
            fileDataSource[result.path] = result.content;
            if (!openTabs.some(t => t.path === result.path)) {
                openTabs.push({ id: result.path, name: result.path.split('/').pop() || result.path, path: result.path });
            }
        }
      }
    }

    // 2. Build the file tree from the set of all known paths.
    const fileTree: FileTreeNode[] = [];
    const directoryMeta: Record<string, { expanded: boolean }> = {};
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
            directoryMeta[nodePath + '/'] = { expanded: true }; // Auto-expand all for simplicity
          }
        } else {
          fileTree.push({ id: nodePath, name: part, path: nodePath, type: 'file', depth: i });
        }
        currentPath = nodePath;
      }
    }

    // 3. Determine the active tab (most recently mentioned file).
    const activeTabId = openTabs.length > 0 ? openTabs[openTabs.length - 1].id : null;

    return { fileDataSource, fileTree, openTabs, activeTabId, directoryMeta };
  }, [messages]);
}
