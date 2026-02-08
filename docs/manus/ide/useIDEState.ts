
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
    const openTabs: { id: string; name: string; path: string }[] = [];
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
