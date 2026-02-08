
'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { PlannerWithToolSwitcher } from './components/PlannerWithToolSwitcher';
import { ManusCanvas } from './components/ManusCanvas'; // Assuming this exists from previous steps

// Mock data for demonstration
const mockPlan = {
  id: 'plan-1',
  title: 'Analyze Redux State and Build UI',
  description: 'A complete plan to fulfill the user request.',
  todos: [
    {
      id: 'step-1',
      label: 'Analyze Redux state for planning system',
      status: 'completed' as const,
      description: 'Deep dive into websocket events to find plan-related data.',
      toolsUsed: [
        { toolName: 'shell_exec', toolCallId: 'tool-1', canvasView: 'Terminal' as const },
        { toolName: 'shell_exec', toolCallId: 'tool-2', canvasView: 'Terminal' as const },
      ],
    },
    {
      id: 'step-2',
      label: 'Research tool-ui component on GitHub',
      status: 'completed' as const,
      description: 'Read the source code for the Plan component.',
      toolsUsed: [
        { toolName: 'browser_navigate', toolCallId: 'tool-3', canvasView: 'Browser' as const },
        { toolName: 'file_read', toolCallId: 'tool-4', canvasView: 'CodeIDE' as const },
      ],
    },
    {
      id: 'step-3',
      label: 'Build Planner + Tool Switcher Component',
      status: 'in_progress' as const,
      description: 'Write the JSX and state logic for the new component.',
      toolsUsed: [
        { toolName: 'file_write', toolCallId: 'tool-5', canvasView: 'CodeIDE' as const },
      ],
    },
    {
      id: 'step-4',
      label: 'Deliver Final Result',
      status: 'pending' as const,
    },
  ],
};

export default function ChatPage() {
  const { messages } = useChat(); // We're not using the chat functionality here, just the structure
  const [activeToolCallId, setActiveToolCallId] = useState<string | null>('tool-5');
  const [activeCanvasView, setActiveCanvasView] = useState<any>('CodeIDE');

  const handleToolSelect = (toolCallId: string, canvasView: any) => {
    setActiveToolCallId(toolCallId);
    setActiveCanvasView(canvasView);
    // In a real app, you would find the corresponding tool call/result from the
    // `messages` array and pass its data to the ManusCanvas.
  };

  // Mock canvas props based on the selected tool
  const canvasProps = {
    viewType: activeCanvasView,
    isWorking: false,
    statusText: 'Idle',
    currentAction: `Viewing result of ${activeToolCallId}`,
    // In a real app, these would be populated from the selected tool's data
    browserUrl: activeToolCallId === 'tool-3' ? 'https://github.com/assistant-ui/tool-ui' : '',
    terminalOutput: activeToolCallId === 'tool-1' ? 'Found 172 websocket events...' : '',
    activeFileContent: activeToolCallId === 'tool-5' ? '// Writing component code...' : '',
  };

  return (
    <div className="flex h-screen bg-[#0a0a14] text-white font-sans">
      {/* Left Panel: Chat and Planner */}
      <div className="w-1/2 flex flex-col border-r border-[#1e1e2e]">
        <div className="p-4 border-b border-[#1e1e2e]">
          <h1 className="font-semibold">Planner & Tool Switcher Demo</h1>
        </div>

        {/* Planner Component */}
        <div className="p-4">
          <PlannerWithToolSwitcher
            {...mockPlan}
            onToolSelect={handleToolSelect}
            activeToolCallId={activeToolCallId}
          />
        </div>

        {/* Chat would go here */}
        <div className="flex-1 p-4">
          {/* Chat messages would be rendered here */}
        </div>
      </div>

      {/* Right Panel: Canvas */}
      <div className="w-1/2 p-4">
        <ManusCanvas {...canvasProps} />
      </div>
    </div>
  );
}
