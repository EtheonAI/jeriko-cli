"use client";

import * as React from "react";
import { useMemo } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { AgentNode, type AgentData } from "./agent-node";
import { AgentConnector } from "./agent-connector";

export interface AgentDagPanelProps {
  agents: AgentData[];
  className?: string;
  selectedAgentId?: string | null;
  onAgentSelect?: (agentId: string) => void;
  variant?: "horizontal" | "vertical";
  compact?: boolean;
}

/**
 * AgentDagPanel - Horizontal row of agent nodes with vertical task lists
 *
 * Layout:
 * [Orchestrator] → [Researcher] → [Coder] → [Browser] → [Executor]
 *      │               │             │           │           │
 *   [Tasks]         [Tasks]       [Tasks]     [Tasks]     [Tasks]
 */
export function AgentDagPanel({
  agents,
  className,
  selectedAgentId,
  onAgentSelect,
  variant = "horizontal",
  compact = false,
}: AgentDagPanelProps) {
  // Calculate connections between agents
  const connections = useMemo(() => {
    const conns: Array<{ from: string; to: string }> = [];

    agents.forEach((agent) => {
      if (agent.dependsOn) {
        agent.dependsOn.forEach((depId) => {
          conns.push({ from: depId, to: agent.id });
        });
      }
    });

    return conns;
  }, [agents]);

  // Sort agents by dependencies (topological sort simplified)
  const sortedAgents = useMemo(() => {
    // Simple sort by type priority for now
    const priorityMap: Record<string, number> = {
      orchestrator: 0,
      researcher: 1,
      analyst: 2,
      coder: 3,
      browser: 4,
      file_manager: 5,
      executor: 6,
    };

    return [...agents].sort((a, b) => {
      const aPriority = priorityMap[a.type] ?? 99;
      const bPriority = priorityMap[b.type] ?? 99;
      return aPriority - bPriority;
    });
  }, [agents]);

  if (agents.length === 0) {
    return null;
  }

  if (variant === "vertical") {
    return (
      <div className={cn("space-y-2", className)}>
        {sortedAgents.map((agent, index) => (
          <div key={agent.id} className="relative">
            {/* Vertical connector */}
            {index > 0 && (
              <div className="absolute -top-1 left-1/2 h-2 w-0.5 -translate-x-1/2 bg-border" />
            )}
            <AgentNode
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              onClick={() => onAgentSelect?.(agent.id)}
              compact={compact}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {/* Agents row */}
      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        {sortedAgents.map((agent, index) => (
          <div key={agent.id} className="relative flex-shrink-0">
            <AgentNode
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              onClick={() => onAgentSelect?.(agent.id)}
              compact={compact}
            />

            {/* Horizontal connector to next agent */}
            {index < sortedAgents.length - 1 && (
              <AgentConnector
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full"
                direction="horizontal"
                status={
                  agent.status === "completed"
                    ? "completed"
                    : agent.status === "executing" || agent.status === "thinking"
                    ? "active"
                    : "pending"
                }
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
