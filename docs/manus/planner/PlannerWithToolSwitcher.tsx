
'use client';

import React, { useState, useMemo } from 'react';
import { Plan as ToolUIPlan, PlanProps, PlanTodo } from '@/components/tool-ui/plan'; // Assuming you have tool-ui installed
import { Terminal, Code, Globe } from 'lucide-react';

// Define the extra props for our enhanced component
export type PlanStepTool = {
  toolName: string;
  toolCallId: string;
  canvasView: 'Terminal' | 'Browser' | 'CodeIDE' | 'FilePreview' | 'Empty';
};

export type PlanTodoWithTools = PlanTodo & {
  toolsUsed?: PlanStepTool[];
};

export type PlannerWithToolSwitcherProps = Omit<PlanProps, 'todos'> & {
  todos: PlanTodoWithTools[];
  onToolSelect: (toolCallId: string, canvasView: PlanStepTool['canvasView']) => void;
  activeToolCallId?: string;
};

// The main component
export function PlannerWithToolSwitcher({ todos, onToolSelect, activeToolCallId, ...planProps }: PlannerWithToolSwitcherProps) {
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);

  const renderableTodos = useMemo(() => {
    return todos.map(todo => ({
      ...todo,
      // Override the description to include our tool switcher UI
      description: (
        <div className="-ml-9 -mr-2">
          {todo.description && <p className="mb-2 text-sm text-muted-foreground">{todo.description}</p>}
          {todo.toolsUsed && todo.toolsUsed.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {todo.toolsUsed.map(tool => (
                <button
                  key={tool.toolCallId}
                  onClick={() => onToolSelect(tool.toolCallId, tool.canvasView)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                    activeToolCallId === tool.toolCallId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {getToolIcon(tool.canvasView)}
                  {tool.toolName.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
    }));
  }, [todos, onToolSelect, activeToolCallId]);

  return (
    <ToolUIPlan
      {...planProps}
      todos={renderableTodos as any} // Cast because we replaced description with a ReactNode
    />
  );
}

// Helper to get an icon for each tool type
function getToolIcon(canvasView: PlanStepTool['canvasView']) {
  switch (canvasView) {
    case 'Terminal':
      return <Terminal className="size-3" />;
    case 'CodeIDE':
      return <Code className="size-3" />;
    case 'Browser':
      return <Globe className="size-3" />;
    default:
      return null;
  }
}
