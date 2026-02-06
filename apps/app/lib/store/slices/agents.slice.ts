import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AgentType =
  | "orchestrator"
  | "researcher"
  | "coder"
  | "browser"
  | "file_manager"
  | "executor"
  | "analyst";

export type AgentStatus = "idle" | "thinking" | "executing" | "waiting" | "completed" | "failed";

export interface Agent {
  id: string;
  sessionId: string;
  type: AgentType;
  name: string | null;
  status: AgentStatus;
  currentTask: string | null;
  progress: number;
  lastActivity: string | null;
  metadata?: {
    model?: string;
    tools?: string[];
    capabilities?: string[];
    [key: string]: unknown;
  };
}

export interface AgentTask {
  id: string;
  agentId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  priority: number;
  result?: {
    success: boolean;
    output?: unknown;
    error?: string;
  };
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AgentsState {
  agents: Record<string, Agent[]>; // sessionId -> agents
  tasks: Record<string, AgentTask[]>; // agentId -> tasks
  selectedAgentId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AgentsState = {
  agents: {},
  tasks: {},
  selectedAgentId: null,
  isLoading: false,
  error: null,
};

export const agentsSlice = createSlice({
  name: "agents",
  initialState,
  reducers: {
    setAgents: (state, action: PayloadAction<{ sessionId: string; agents: Agent[] }>) => {
      state.agents[action.payload.sessionId] = action.payload.agents;
      state.isLoading = false;
      state.error = null;
    },
    addAgent: (state, action: PayloadAction<Agent>) => {
      const { sessionId } = action.payload;
      if (!state.agents[sessionId]) {
        state.agents[sessionId] = [];
      }
      // Prevent duplicates — update existing agent or add new
      const existingIndex = state.agents[sessionId].findIndex((a) => a.id === action.payload.id);
      if (existingIndex >= 0) {
        state.agents[sessionId][existingIndex] = action.payload;
      } else {
        state.agents[sessionId].push(action.payload);
      }
    },
    updateAgent: (
      state,
      action: PayloadAction<{ id: string; sessionId: string; updates: Partial<Agent> }>
    ) => {
      const { id, sessionId, updates } = action.payload;
      const agents = state.agents[sessionId];
      if (agents) {
        const index = agents.findIndex((a) => a.id === id);
        if (index !== -1) {
          agents[index] = { ...agents[index], ...updates };
        }
      }
    },
    removeAgent: (state, action: PayloadAction<{ id: string; sessionId: string }>) => {
      const { id, sessionId } = action.payload;
      const agents = state.agents[sessionId];
      if (agents) {
        state.agents[sessionId] = agents.filter((a) => a.id !== id);
      }
      // Also remove tasks
      delete state.tasks[id];
      if (state.selectedAgentId === id) {
        state.selectedAgentId = null;
      }
    },
    setTasks: (state, action: PayloadAction<{ agentId: string; tasks: AgentTask[] }>) => {
      state.tasks[action.payload.agentId] = action.payload.tasks;
    },
    addTask: (state, action: PayloadAction<AgentTask>) => {
      const { agentId } = action.payload;
      if (!state.tasks[agentId]) {
        state.tasks[agentId] = [];
      }
      state.tasks[agentId].push(action.payload);
    },
    updateTask: (
      state,
      action: PayloadAction<{ id: string; agentId: string; updates: Partial<AgentTask> }>
    ) => {
      const { id, agentId, updates } = action.payload;
      const tasks = state.tasks[agentId];
      if (tasks) {
        const index = tasks.findIndex((t) => t.id === id);
        if (index !== -1) {
          tasks[index] = { ...tasks[index], ...updates };
        }
      }
    },
    setSelectedAgent: (state, action: PayloadAction<string | null>) => {
      state.selectedAgentId = action.payload;
    },
    setAgentsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setAgentsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const {
  setAgents,
  addAgent,
  updateAgent,
  removeAgent,
  setTasks,
  addTask,
  updateTask,
  setSelectedAgent,
  setAgentsLoading,
  setAgentsError,
} = agentsSlice.actions;

export default agentsSlice.reducer;
