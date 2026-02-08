// =============================================================================
// ManusCanvas.tsx — Complete "Manus's Computer" Right-Side Canvas Component
// =============================================================================
// This is a faithful recreation of the right-side canvas/computer window
// from the Manus AI agent interface. It handles all view types:
// Browser, Code IDE, Terminal, File Preview, Slides, AI Canvas, Web Dev IDE,
// Map/Reduce, and a default empty state.
//
// Dependencies: React, Tailwind CSS, lucide-react (for icons)
// Optional: @xterm/xterm (for terminal), monaco-editor (for code), react-vnc
// =============================================================================

import React, { useState, useRef, useEffect } from "react";
import {
  Monitor,
  Globe,
  Code,
  Terminal,
  FileText,
  Presentation,
  Paintbrush,
  LayoutGrid,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  X,
  Folder,
  File,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Search,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Loader2,
  MousePointer,
  Keyboard,
  ScrollText,
  Eye,
  Edit3,
  BookOpen,
  Database,
  Cloud,
  Settings,
  type LucideIcon,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

/** The different view modes the canvas can display */
type CanvasViewType =
  | "browser"
  | "code"
  | "terminal"
  | "filePreview"
  | "slides"
  | "aiCanvas"
  | "webDevIDE"
  | "mapReduce"
  | "empty";

/** Represents a tool action badge shown in the header */
interface ToolAction {
  type:
    | "browsing"
    | "clicking"
    | "typing"
    | "scrolling"
    | "viewing"
    | "editing"
    | "reading"
    | "creating"
    | "searching";
  label: string;
}

/** A file/folder node in the code IDE tree */
interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

/** A tab in the code IDE */
interface FileTab {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
}

/** Props for the main ManusCanvas component */
interface ManusCanvasProps {
  /** Which view to display */
  viewType: CanvasViewType;
  /** Whether the canvas is in fullscreen mode */
  isFullscreen?: boolean;
  /** Callback when fullscreen is toggled */
  onToggleFullscreen?: () => void;
  /** Callback when the canvas is closed */
  onClose?: () => void;

  // --- Browser View Props ---
  /** Current URL being browsed */
  browserUrl?: string;
  /** Screenshot/image of the current browser page */
  browserScreenshot?: string;
  /** Whether the browser is loading */
  browserLoading?: boolean;

  // --- Code IDE Props ---
  /** File tree for the code viewer */
  fileTree?: FileNode[];
  /** Open tabs */
  fileTabs?: FileTab[];
  /** Content of the active file */
  activeFileContent?: string;
  /** Language of the active file (for syntax highlighting) */
  activeFileLanguage?: string;

  // --- Terminal Props ---
  /** Terminal output lines */
  terminalOutput?: string[];

  // --- File Preview Props ---
  /** File being previewed */
  previewFileName?: string;
  /** Content or URL of the file preview */
  previewContent?: string;
  /** Type of file being previewed */
  previewFileType?: "image" | "pdf" | "markdown" | "text" | "html";

  // --- Slides Props ---
  /** Array of slide image URLs or HTML content */
  slides?: string[];
  /** Current slide index */
  currentSlideIndex?: number;

  // --- Common Props ---
  /** Current tool action being performed */
  currentAction?: ToolAction;
  /** Agent status text */
  statusText?: string;
  /** Current step number */
  currentStep?: number;
  /** Total steps */
  totalSteps?: number;
  /** Whether the agent is currently working */
  isWorking?: boolean;
  /** Timeline percentage (0-100) */
  timelinePercentage?: number;
  /** Callback when timeline is scrubbed */
  onTimelineChange?: (percentage: number) => void;
}

// =============================================================================
// ICON MAP — maps tool action types to their icons
// =============================================================================

const actionIconMap: Record<ToolAction["type"], LucideIcon> = {
  browsing: Globe,
  clicking: MousePointer,
  typing: Keyboard,
  scrolling: ScrollText,
  viewing: Eye,
  editing: Edit3,
  reading: BookOpen,
  creating: FileText,
  searching: Search,
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/** Tool action badge — the pill-shaped indicator showing what the agent is doing */
function ActionBadge({ action }: { action: ToolAction }) {
  const Icon = actionIconMap[action.type] || Monitor;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-medium">
      <Icon size={12} className="text-gray-400" />
      {action.label}
    </span>
  );
}

/** Browser URL bar */
function BrowserUrlBar({
  url,
  loading,
}: {
  url: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e2e] border-b border-white/5">
      <div className="flex items-center gap-1">
        <button className="p-1 rounded hover:bg-white/10 text-gray-500 transition-colors">
          <ArrowLeft size={14} />
        </button>
        <button className="p-1 rounded hover:bg-white/10 text-gray-500 transition-colors">
          <ArrowRight size={14} />
        </button>
        <button className="p-1 rounded hover:bg-white/10 text-gray-500 transition-colors">
          <RotateCcw size={14} />
        </button>
      </div>
      <div className="flex-1 flex items-center gap-2 px-3 py-1 rounded-md bg-[#0d0d1a] text-xs text-gray-400 font-mono truncate">
        {loading && (
          <Loader2 size={12} className="animate-spin text-blue-400" />
        )}
        <span className="truncate">{url || "about:blank"}</span>
      </div>
      <button className="p-1 rounded hover:bg-white/10 text-gray-500 transition-colors">
        <ExternalLink size={14} />
      </button>
    </div>
  );
}

/** File tree node (recursive) */
function FileTreeNode({
  node,
  depth = 0,
  onSelect,
  selectedPath,
}: {
  node: FileNode;
  depth?: number;
  onSelect?: (path: string) => void;
  selectedPath?: string;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const isDirectory = node.type === "directory";
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <button
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-white/5 transition-colors ${
          isSelected ? "bg-white/10 text-white" : "text-gray-400"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isDirectory) setIsOpen(!isOpen);
          else onSelect?.(node.path);
        }}
      >
        {isDirectory ? (
          isOpen ? (
            <ChevronDown size={12} />
          ) : (
            <ChevronRightIcon size={12} />
          )
        ) : (
          <span className="w-3" />
        )}
        {isDirectory ? (
          <Folder size={14} className="text-blue-400" />
        ) : (
          <File size={14} className="text-gray-500" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDirectory && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Code IDE file tabs bar */
function FileTabsBar({
  tabs,
  onSelectTab,
}: {
  tabs: FileTab[];
  onSelectTab?: (id: string) => void;
}) {
  return (
    <div className="flex items-center bg-[#1e1e2e] border-b border-white/5 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs border-r border-white/5 whitespace-nowrap transition-colors ${
            tab.isActive
              ? "bg-[#0d0d1a] text-white border-t-2 border-t-blue-500"
              : "text-gray-500 hover:bg-white/5"
          }`}
          onClick={() => onSelectTab?.(tab.id)}
        >
          <File size={12} />
          {tab.name}
          <X size={10} className="ml-1 opacity-50 hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}

/** Timeline scrubber at the bottom */
function TimelineScrubber({
  percentage = 0,
  isPlaying = false,
  onChange,
  onTogglePlay,
}: {
  percentage?: number;
  isPlaying?: boolean;
  onChange?: (val: number) => void;
  onTogglePlay?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#0d0d1a] border-t border-white/5">
      <button
        className="p-1 rounded hover:bg-white/10 text-gray-500 transition-colors"
        onClick={() => onChange?.(0)}
      >
        <SkipBack size={14} />
      </button>
      <button
        className="p-1 rounded hover:bg-white/10 text-gray-400 transition-colors"
        onClick={onTogglePlay}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="flex-1 relative h-1 bg-white/10 rounded-full cursor-pointer group">
        <div
          className="absolute left-0 top-0 h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${percentage}%`, marginLeft: "-6px" }}
        />
      </div>
      <button
        className="p-1 rounded hover:bg-white/10 text-gray-500 transition-colors"
        onClick={() => onChange?.(100)}
      >
        <SkipForward size={14} />
      </button>
    </div>
  );
}

// =============================================================================
// VIEW RENDERERS — each view type gets its own render function
// =============================================================================

/** Browser View — shows a VNC-like browser screenshot with URL bar */
function BrowserView({
  url,
  screenshot,
  loading,
}: {
  url?: string;
  screenshot?: string;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <BrowserUrlBar url={url || ""} loading={loading} />
      <div className="flex-1 relative bg-[#0d0d1a] overflow-hidden">
        {screenshot ? (
          <img
            src={screenshot}
            alt="Browser view"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600">
            <div className="text-center">
              <Globe size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Waiting for browser content...</p>
            </div>
          </div>
        )}
        {loading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500/30">
            <div className="h-full bg-blue-500 animate-pulse w-2/3" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Code IDE View — file tree + tabs + code editor */
function CodeIDEView({
  fileTree,
  fileTabs,
  activeFileContent,
  activeFileLanguage,
}: {
  fileTree?: FileNode[];
  fileTabs?: FileTab[];
  activeFileContent?: string;
  activeFileLanguage?: string;
}) {
  const [selectedPath, setSelectedPath] = useState<string>("");

  return (
    <div className="flex h-full">
      {/* File Tree Sidebar */}
      <div className="w-56 bg-[#12121e] border-r border-white/5 overflow-y-auto flex-shrink-0">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Explorer
        </div>
        {fileTree?.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            onSelect={setSelectedPath}
            selectedPath={selectedPath}
          />
        ))}
        {(!fileTree || fileTree.length === 0) && (
          <div className="px-3 py-4 text-xs text-gray-600 text-center">
            No files yet
          </div>
        )}
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {fileTabs && fileTabs.length > 0 && <FileTabsBar tabs={fileTabs} />}
        <div className="flex-1 overflow-auto bg-[#0d0d1a] p-4">
          {activeFileContent ? (
            <pre className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap">
              {activeFileContent.split("\n").map((line, i) => (
                <div key={i} className="flex">
                  <span className="inline-block w-10 text-right pr-4 text-gray-600 select-none flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1">{line}</span>
                </div>
              ))}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
              <div className="text-center">
                <Code size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a file to view its contents</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Terminal View — shows shell output */
function TerminalView({ output }: { output?: string[] }) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e2e] border-b border-white/5">
        <Terminal size={14} className="text-green-400" />
        <span className="text-xs text-gray-400 font-medium">Terminal</span>
        <span className="text-xs text-gray-600 font-mono">bash</span>
      </div>
      <div
        ref={terminalRef}
        className="flex-1 overflow-auto bg-[#0a0a14] p-3 font-mono text-xs leading-relaxed"
      >
        {output?.map((line, i) => (
          <div key={i} className="text-gray-300">
            {line.startsWith("$") ? (
              <>
                <span className="text-green-400">ubuntu@sandbox</span>
                <span className="text-gray-500">:</span>
                <span className="text-blue-400">~</span>
                <span className="text-gray-300">{line}</span>
              </>
            ) : (
              <span>{line}</span>
            )}
          </div>
        ))}
        {(!output || output.length === 0) && (
          <div className="text-gray-600">
            <span className="text-green-400">ubuntu@sandbox</span>
            <span className="text-gray-500">:</span>
            <span className="text-blue-400">~</span>
            <span className="text-gray-300">$ </span>
            <span className="animate-pulse">▊</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** File Preview View — shows a file preview (image, markdown, text) */
function FilePreviewView({
  fileName,
  content,
  fileType,
}: {
  fileName?: string;
  content?: string;
  fileType?: "image" | "pdf" | "markdown" | "text" | "html";
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e2e] border-b border-white/5">
        <FileText size={14} className="text-orange-400" />
        <span className="text-xs text-gray-300 font-medium truncate">
          {fileName || "Untitled"}
        </span>
      </div>
      <div className="flex-1 overflow-auto bg-[#0d0d1a] p-4">
        {fileType === "image" && content ? (
          <img
            src={content}
            alt={fileName}
            className="max-w-full mx-auto rounded"
          />
        ) : (
          <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap leading-relaxed">
            {content || "No content to preview"}
          </pre>
        )}
      </div>
    </div>
  );
}

/** Slides View — shows a presentation slide */
function SlidesView({
  slides,
  currentIndex = 0,
}: {
  slides?: string[];
  currentIndex?: number;
}) {
  const [index, setIndex] = useState(currentIndex);
  const total = slides?.length || 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-[#1e1e2e] border-b border-white/5">
        <div className="flex items-center gap-2">
          <Presentation size={14} className="text-purple-400" />
          <span className="text-xs text-gray-300 font-medium">
            Slide Editor
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {index + 1} / {total}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-[#0d0d1a] p-6 relative">
        {slides && slides[index] ? (
          <div className="w-full max-w-2xl aspect-video bg-white rounded-lg shadow-2xl overflow-hidden">
            <img
              src={slides[index]}
              alt={`Slide ${index + 1}`}
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="text-center text-gray-600">
            <Presentation size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No slides to display</p>
          </div>
        )}
        {total > 1 && (
          <>
            <button
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={() => setIndex(Math.max(0, index - 1))}
              disabled={index === 0}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={() => setIndex(Math.min(total - 1, index + 1))}
              disabled={index === total - 1}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** AI Canvas View — placeholder for the drawing canvas */
function AICanvasView() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e2e] border-b border-white/5">
        <Paintbrush size={14} className="text-pink-400" />
        <span className="text-xs text-gray-300 font-medium">AI Canvas</span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-[#0d0d1a]">
        <div className="text-center text-gray-600">
          <Paintbrush size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Canvas workspace</p>
          <p className="text-xs text-gray-700 mt-1">
            Draw, annotate, and create with AI
          </p>
        </div>
      </div>
    </div>
  );
}

/** Web Dev IDE View — full IDE with tabs for Code, Database, Storage, Settings */
function WebDevIDEView({
  fileTree,
  activeFileContent,
}: {
  fileTree?: FileNode[];
  activeFileContent?: string;
}) {
  const [activeTab, setActiveTab] = useState<string>("code");
  const tabs = [
    { id: "code", label: "Code", icon: Code },
    { id: "database", label: "Database", icon: Database },
    { id: "storage", label: "Storage", icon: Cloud },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Top tab bar */}
      <div className="flex items-center bg-[#1e1e2e] border-b border-white/5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs transition-colors ${
                activeTab === tab.id
                  ? "text-white border-b-2 border-blue-500 bg-[#0d0d1a]"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "code" && (
          <CodeIDEView
            fileTree={fileTree}
            activeFileContent={activeFileContent}
          />
        )}
        {activeTab === "database" && (
          <div className="flex items-center justify-center h-full bg-[#0d0d1a] text-gray-600">
            <div className="text-center">
              <Database size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Database Browser</p>
            </div>
          </div>
        )}
        {activeTab === "storage" && (
          <div className="flex items-center justify-center h-full bg-[#0d0d1a] text-gray-600">
            <div className="text-center">
              <Cloud size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Cloud Storage</p>
            </div>
          </div>
        )}
        {activeTab === "settings" && (
          <div className="flex items-center justify-center h-full bg-[#0d0d1a] text-gray-600">
            <div className="text-center">
              <Settings size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Project Settings</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Map/Reduce View — parallel processing visualization */
function MapReduceView() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1e2e] border-b border-white/5">
        <LayoutGrid size={14} className="text-cyan-400" />
        <span className="text-xs text-gray-300 font-medium">
          Parallel Processing
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-[#0d0d1a]">
        <div className="text-center text-gray-600">
          <LayoutGrid size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Map/Reduce Tasks</p>
          <p className="text-xs text-gray-700 mt-1">
            Parallel subtask execution
          </p>
        </div>
      </div>
    </div>
  );
}

/** Empty/Default View — shown when no tool is active */
function EmptyView() {
  return (
    <div className="flex items-center justify-center h-full bg-[#0d0d1a]">
      <div className="text-center">
        <Monitor size={64} className="mx-auto mb-4 text-gray-700 opacity-40" />
        <h3 className="text-sm font-medium text-gray-500 mb-1">
          Manus&apos;s Computer
        </h3>
        <p className="text-xs text-gray-600 max-w-xs">
          The agent&apos;s workspace will appear here when it starts working on
          your task.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// VIEW TYPE METADATA — maps view types to their display info
// =============================================================================

const viewTypeInfo: Record<
  CanvasViewType,
  { label: string; icon: LucideIcon; color: string }
> = {
  browser: { label: "Browser", icon: Globe, color: "text-blue-400" },
  code: { label: "Code Editor", icon: Code, color: "text-green-400" },
  terminal: { label: "Terminal", icon: Terminal, color: "text-green-400" },
  filePreview: {
    label: "File Preview",
    icon: FileText,
    color: "text-orange-400",
  },
  slides: {
    label: "Slide Editor",
    icon: Presentation,
    color: "text-purple-400",
  },
  aiCanvas: { label: "AI Canvas", icon: Paintbrush, color: "text-pink-400" },
  webDevIDE: { label: "Web Dev IDE", icon: Code, color: "text-emerald-400" },
  mapReduce: {
    label: "Parallel Processing",
    icon: LayoutGrid,
    color: "text-cyan-400",
  },
  empty: { label: "Computer", icon: Monitor, color: "text-gray-400" },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ManusCanvas({
  viewType = "empty",
  isFullscreen = false,
  onToggleFullscreen,
  onClose,
  browserUrl,
  browserScreenshot,
  browserLoading,
  fileTree,
  fileTabs,
  activeFileContent,
  activeFileLanguage,
  terminalOutput,
  previewFileName,
  previewContent,
  previewFileType,
  slides,
  currentSlideIndex,
  currentAction,
  statusText,
  currentStep,
  totalSteps,
  isWorking = false,
  timelinePercentage = 0,
  onTimelineChange,
}: ManusCanvasProps) {
  const viewInfo = viewTypeInfo[viewType];
  const ViewIcon = viewInfo.icon;

  return (
    <div
      className={`flex flex-col bg-[#12121e] rounded-xl overflow-hidden shadow-2xl border border-white/5 ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : "h-full"
      }`}
    >
      {/* ================================================================= */}
      {/* HEADER — "Manus's Computer" title bar                             */}
      {/* ================================================================= */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#16162a] border-b border-white/5">
        <div className="flex flex-col gap-1">
          {/* Title */}
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-white">
              Manus&apos;s Computer
            </h2>
          </div>

          {/* Status line: "Manus is using Browser" + action badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {viewType !== "empty" && (
              <span className="text-xs text-gray-500">
                Manus is using{" "}
                <span className={`font-medium ${viewInfo.color}`}>
                  {viewInfo.label}
                </span>
              </span>
            )}
            {currentAction && <ActionBadge action={currentAction} />}
          </div>
        </div>

        {/* Header buttons */}
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 transition-colors"
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {onClose && (
            <button
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 transition-colors"
              onClick={onClose}
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* MAIN CONTENT AREA — renders the active view                       */}
      {/* ================================================================= */}
      <div className="flex-1 overflow-hidden">
        {viewType === "browser" && (
          <BrowserView
            url={browserUrl}
            screenshot={browserScreenshot}
            loading={browserLoading}
          />
        )}
        {viewType === "code" && (
          <CodeIDEView
            fileTree={fileTree}
            fileTabs={fileTabs}
            activeFileContent={activeFileContent}
            activeFileLanguage={activeFileLanguage}
          />
        )}
        {viewType === "terminal" && <TerminalView output={terminalOutput} />}
        {viewType === "filePreview" && (
          <FilePreviewView
            fileName={previewFileName}
            content={previewContent}
            fileType={previewFileType}
          />
        )}
        {viewType === "slides" && (
          <SlidesView slides={slides} currentIndex={currentSlideIndex} />
        )}
        {viewType === "aiCanvas" && <AICanvasView />}
        {viewType === "webDevIDE" && (
          <WebDevIDEView
            fileTree={fileTree}
            activeFileContent={activeFileContent}
          />
        )}
        {viewType === "mapReduce" && <MapReduceView />}
        {viewType === "empty" && <EmptyView />}
      </div>

      {/* ================================================================= */}
      {/* TIMELINE SCRUBBER — bottom bar with playback controls              */}
      {/* ================================================================= */}
      <TimelineScrubber
        percentage={timelinePercentage}
        onChange={onTimelineChange}
      />

      {/* ================================================================= */}
      {/* STATUS BAR — "Manus is working: ..." at the very bottom           */}
      {/* ================================================================= */}
      {(isWorking || statusText) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0d0d1a] border-t border-white/5">
          {isWorking && (
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
          <span className="text-xs text-gray-500 truncate flex-1">
            {statusText || "Manus is working..."}
          </span>
          {currentStep != null && totalSteps != null && (
            <span className="text-xs text-gray-600 font-mono flex-shrink-0">
              {currentStep}:{String(totalSteps).padStart(2, "0")}
            </span>
          )}
          {currentAction && (
            <span className="text-xs text-gray-600">{currentAction.label}</span>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default ManusCanvas;
