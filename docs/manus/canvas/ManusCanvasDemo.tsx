// =============================================================================
// ManusCanvasDemo.tsx — Demo page showing all canvas view types with mock data
// =============================================================================
// This file demonstrates how to use the ManusCanvas component with different
// view types. It provides a tabbed interface to switch between all 9 views.
// =============================================================================

import React, { useState } from "react";
import { ManusCanvas } from "./ManusCanvas";
import type { CanvasViewType } from "./ManusCanvas";

// =============================================================================
// MOCK DATA
// =============================================================================

const mockFileTree = [
  {
    name: "src",
    path: "/home/ubuntu/project/src",
    type: "directory" as const,
    children: [
      {
        name: "components",
        path: "/home/ubuntu/project/src/components",
        type: "directory" as const,
        children: [
          {
            name: "App.tsx",
            path: "/home/ubuntu/project/src/components/App.tsx",
            type: "file" as const,
          },
          {
            name: "Header.tsx",
            path: "/home/ubuntu/project/src/components/Header.tsx",
            type: "file" as const,
          },
          {
            name: "Sidebar.tsx",
            path: "/home/ubuntu/project/src/components/Sidebar.tsx",
            type: "file" as const,
          },
        ],
      },
      {
        name: "hooks",
        path: "/home/ubuntu/project/src/hooks",
        type: "directory" as const,
        children: [
          {
            name: "useAuth.ts",
            path: "/home/ubuntu/project/src/hooks/useAuth.ts",
            type: "file" as const,
          },
          {
            name: "useWebSocket.ts",
            path: "/home/ubuntu/project/src/hooks/useWebSocket.ts",
            type: "file" as const,
          },
        ],
      },
      {
        name: "index.tsx",
        path: "/home/ubuntu/project/src/index.tsx",
        type: "file" as const,
      },
      {
        name: "styles.css",
        path: "/home/ubuntu/project/src/styles.css",
        type: "file" as const,
      },
    ],
  },
  {
    name: "package.json",
    path: "/home/ubuntu/project/package.json",
    type: "file" as const,
  },
  {
    name: "tsconfig.json",
    path: "/home/ubuntu/project/tsconfig.json",
    type: "file" as const,
  },
  {
    name: "README.md",
    path: "/home/ubuntu/project/README.md",
    type: "file" as const,
  },
];

const mockFileTabs = [
  { id: "1", name: "App.tsx", path: "/src/components/App.tsx", isActive: true },
  {
    id: "2",
    name: "Header.tsx",
    path: "/src/components/Header.tsx",
    isActive: false,
  },
  {
    id: "3",
    name: "useAuth.ts",
    path: "/src/hooks/useAuth.ts",
    isActive: false,
  },
];

const mockFileContent = `import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';

interface AppProps {
  children: React.ReactNode;
}

export function App({ children }: AppProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <Sidebar user={user} />
      <main className="flex-1 overflow-auto">
        <Header user={user} />
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default App;`;

const mockTerminalOutput = [
  "$ cd /home/ubuntu/project",
  "$ npm install",
  "added 1247 packages in 32s",
  "",
  "$ npm run build",
  "> project@1.0.0 build",
  "> vite build",
  "",
  "vite v5.4.1 building for production...",
  "✓ 1247 modules transformed.",
  "dist/index.html                  0.46 kB │ gzip:  0.30 kB",
  "dist/assets/index-DiwrgTda.css   8.76 kB │ gzip:  2.58 kB",
  "dist/assets/index-BqG7Ksxo.js  142.63 kB │ gzip: 45.87 kB",
  "✓ built in 2.34s",
  "",
  "$ npm run preview",
  "> project@1.0.0 preview",
  "> vite preview",
  "",
  "  ➜  Local:   http://localhost:4173/",
  "  ➜  Network: http://192.168.1.100:4173/",
];

// =============================================================================
// DEMO COMPONENT
// =============================================================================

const viewTypes: { id: CanvasViewType; label: string }[] = [
  { id: "empty", label: "Empty" },
  { id: "browser", label: "Browser" },
  { id: "code", label: "Code IDE" },
  { id: "terminal", label: "Terminal" },
  { id: "filePreview", label: "File Preview" },
  { id: "slides", label: "Slides" },
  { id: "aiCanvas", label: "AI Canvas" },
  { id: "webDevIDE", label: "Web Dev IDE" },
  { id: "mapReduce", label: "Map/Reduce" },
];

export default function ManusCanvasDemo() {
  const [activeView, setActiveView] = useState<CanvasViewType>("browser");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timelinePercentage, setTimelinePercentage] = useState(65);

  // Map each view type to its specific props
  const viewProps: Record<string, any> = {
    browser: {
      browserUrl: "https://www.sreality.cz/en/search/for-rent/apartments",
      browserLoading: false,
      currentAction: { type: "clicking", label: "Clicking element" },
    },
    code: {
      fileTree: mockFileTree,
      fileTabs: mockFileTabs,
      activeFileContent: mockFileContent,
      activeFileLanguage: "typescript",
      currentAction: { type: "editing", label: "Editing file App.tsx" },
    },
    terminal: {
      terminalOutput: mockTerminalOutput,
      currentAction: { type: "typing", label: "Running build command" },
    },
    filePreview: {
      previewFileName: "analysis_report.md",
      previewContent:
        "# Analysis Report\n\n## Summary\n\nThe data shows a 23% increase in user engagement...\n\n## Key Findings\n\n1. Mobile traffic increased by 45%\n2. Average session duration: 4m 32s\n3. Bounce rate decreased to 28%\n\n## Recommendations\n\n- Optimize mobile experience\n- Add more interactive elements\n- Improve page load times",
      previewFileType: "markdown",
      currentAction: { type: "reading", label: "Reading file analysis_report.md" },
    },
    slides: {
      slides: [],
      currentSlideIndex: 0,
      currentAction: { type: "creating", label: "Creating presentation" },
    },
    aiCanvas: {
      currentAction: { type: "editing", label: "Drawing on canvas" },
    },
    webDevIDE: {
      fileTree: mockFileTree,
      activeFileContent: mockFileContent,
      currentAction: { type: "editing", label: "Building web application" },
    },
    mapReduce: {
      currentAction: { type: "searching", label: "Processing 12 parallel tasks" },
    },
    empty: {},
  };

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white p-6">
      {/* View type selector */}
      <div className="mb-6">
        <h1 className="text-xl font-bold mb-4">
          Manus Canvas Component Demo
        </h1>
        <div className="flex flex-wrap gap-2">
          {viewTypes.map((vt) => (
            <button
              key={vt.id}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeView === vt.id
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 text-gray-400 hover:bg-white/20"
              }`}
              onClick={() => setActiveView(vt.id)}
            >
              {vt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas container */}
      <div className="h-[600px] max-w-4xl">
        <ManusCanvas
          viewType={activeView}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          isWorking={activeView !== "empty"}
          statusText={
            activeView !== "empty"
              ? `Manus is working: ${viewProps[activeView]?.currentAction?.label || "Processing..."}`
              : undefined
          }
          currentStep={6}
          totalSteps={10}
          timelinePercentage={timelinePercentage}
          onTimelineChange={setTimelinePercentage}
          {...viewProps[activeView]}
        />
      </div>
    </div>
  );
}
