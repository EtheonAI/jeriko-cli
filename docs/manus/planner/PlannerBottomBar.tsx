
import React, { useState } from 'react';
import { PlanStep } from '../hooks/usePlannerState';
import { ArrowUp, ArrowDown, CheckCircle, CircleDot, Circle } from 'lucide-react';

interface PlannerBottomBarProps {
  plan: PlanStep[];
  currentStep: number;
  totalSteps: number;
  latestToolThumbnail: string | null;
}

const getStatusIcon = (status: PlanStep['status']) => {
  switch (status) {
    case 'done': return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'doing': return <CircleDot className="w-4 h-4 text-blue-500 animate-pulse" />;
    case 'todo': return <Circle className="w-4 h-4 text-gray-500" />;
    default: return <Circle className="w-4 h-4 text-gray-500" />;
  }
};

export function PlannerBottomBar({ 
  plan, 
  currentStep, 
  totalSteps, 
  latestToolThumbnail 
}: PlannerBottomBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeStep = plan[currentStep - 1];

  return (
    <div className="mb-2 transition-all duration-300">
      {/* Collapsed Bar */}
      <div 
        className="bg-[#16162a] border border-white/10 rounded-lg p-2 flex items-center justify-between cursor-pointer hover:bg-white/5" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {latestToolThumbnail ? (
            <img src={latestToolThumbnail} alt="Tool preview" className="w-8 h-8 rounded-md object-cover bg-black" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center">
              <CircleDot className="w-4 h-4 text-gray-500" />
            </div>
          )}
          <div className="flex items-center gap-2">
            {getStatusIcon(activeStep?.status ?? 'todo')}
            <span className="text-sm text-gray-300">{activeStep?.title ?? 'Initializing plan...'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-gray-400">{currentStep} / {totalSteps}</span>
          <div className="flex items-center gap-1">
            <button className="p-1 rounded-md hover:bg-white/10"><ArrowUp className="w-4 h-4" /></button>
            <button className="p-1 rounded-md hover:bg-white/10"><ArrowDown className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="mt-2 bg-[#12121e] border border-white/10 rounded-lg p-3">
          <h3 className="font-semibold mb-2">Task Plan</h3>
          <ul className="space-y-2">
            {plan.map((step, index) => (
              <li key={index} className="flex items-center gap-3 text-sm">
                {getStatusIcon(step.status)}
                <span className={`${step.status === 'doing' ? 'text-white' : 'text-gray-400'}`}>
                  {step.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
