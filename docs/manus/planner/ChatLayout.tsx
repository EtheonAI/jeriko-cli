
import React from 'react';
import { type Message } from 'ai';
import { ChatMessages } from './ChatMessages'; // Assuming you have a component for the message list
import { PromptForm } from './PromptForm'; // Assuming you have a component for the input
import { PlannerBottomBar } from './PlannerBottomBar'; // The new planner bar
import { usePlannerState } from '../hooks/usePlannerState'; // Hook to derive planner state

interface ChatLayoutProps {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function ChatLayout({ 
  messages, 
  input, 
  handleInputChange, 
  handleSubmit, 
  isLoading 
}: ChatLayoutProps) {
  const { plan, currentStep, totalSteps, latestToolThumbnail } = usePlannerState(messages);

  const isTaskRunning = plan.length > 0 && currentStep < totalSteps;

  return (
    <div className="flex flex-col h-screen bg-[#0a0a14] text-white">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <h1 className="text-lg font-semibold">Manus AI Chat</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Messages - takes up remaining space */}
        <div className="flex-1 overflow-y-auto p-4">
          <ChatMessages messages={messages} />
        </div>

        {/* --- This is the key section --- */}
        {/* It ensures the planner and prompt form are at the bottom */}
        <div className="flex-shrink-0 px-4 pb-4">
          {/* Planner Bottom Bar - only shows when a task is running */}
          {isTaskRunning && (
            <PlannerBottomBar 
              plan={plan}
              currentStep={currentStep}
              totalSteps={totalSteps}
              latestToolThumbnail={latestToolThumbnail}
            />
          )}

          {/* Prompt Form */}
          <PromptForm 
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      </main>
    </div>
  );
}
