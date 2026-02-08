import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { File, FolderOpen } from 'lucide-react';

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  depth: number;
}

interface CodeIDEViewProps {
  fileDataSource: Record<string, string>;
  fileTree: FileTreeNode[];
  openTabs: { id: string; name: string; path: string }[];
  activeTabId: string | null;
}

/**
 * A React component that renders a VS Code-like IDE interface,
 * including a file explorer, tabbed editor, and a code viewer
 * powered by the Monaco Editor.
 */
export function CodeIDEView({ 
  fileDataSource, 
  fileTree, 
  openTabs, 
  activeTabId: initialActiveTabId 
}: CodeIDEViewProps) {
  const [activeTab, setActiveTab] = useState(initialActiveTabId);

  // Effect to sync the active tab when the initial prop changes.
  useEffect(() => {
    setActiveTab(initialActiveTabId);
  }, [initialActiveTabId]);

  const activeFileContent = activeTab ? fileDataSource[activeTab] : '// Select a file to view its content';

  const getFileLanguage = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'json':
        return 'json';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'md':
        return 'markdown';
      case 'py':
        return 'python';
      default:
        return 'plaintext';
    }
  };

  const activeFileName = openTabs.find(t => t.id === activeTab)?.name || '';

  return (
    <div className="flex h-full bg-[#0d0d1a] text-white font-sans">
      {/* File Tree Sidebar */}
      <div className="w-1/3 max-w-xs bg-[#12121e] p-2 overflow-y-auto border-r border-white/10">
        <h3 className="font-semibold text-sm mb-2 px-2 text-gray-400">EXPLORER</h3>
        {fileTree.map(node => (
          <div 
            key={node.id} 
            className={`flex items-center gap-2 p-1 rounded-md cursor-pointer ${activeTab === node.path ? 'bg-blue-500/20' : 'hover:bg-white/10'}`}
            style={{ paddingLeft: `${node.depth * 1 + 0.5}rem` }}
            onClick={() => node.type === 'file' && setActiveTab(node.path)}
          >
            {node.type === 'directory' ? <FolderOpen size={16} className="text-gray-500" /> : <File size={16} className="text-gray-500" />}
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
              className={`px-4 py-2 text-sm border-t-2 flex items-center gap-2 ${activeTab === tab.id ? 'bg-[#0d0d1a] border-blue-500 text-white' : 'border-transparent text-gray-400 hover:bg-white/5'}`}>
              <File size={14} />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 bg-[#1e1e1e]">
          <Editor
            height="100%"
            language={getFileLanguage(activeFileName)}
            theme="vs-dark"
            value={activeFileContent}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
