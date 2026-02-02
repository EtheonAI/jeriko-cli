import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ProjectStatus = "active" | "archived" | "deleted";
export type ProjectType = "general" | "web_dev" | "data_analysis" | "automation" | "research";

export interface ProjectMember {
  userId: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: "owner" | "editor" | "viewer";
  addedAt: string;
}

export interface ProjectSettings {
  isPublic: boolean;
  allowComments: boolean;
  notifyOnUpdate: boolean;
  defaultAgentType?: string;
  connectorIds?: string[];
}

export interface Project {
  id: string;
  userId: string;
  teamId?: string;
  // Basic info
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  type: ProjectType;
  status: ProjectStatus;
  // Members
  members: ProjectMember[];
  // Settings
  settings: ProjectSettings;
  // Stats
  sessionCount: number;
  fileCount: number;
  lastActivityAt?: string;
  // Metadata
  tags?: string[];
  metadata?: Record<string, unknown>;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSession {
  id: string;
  projectId: string;
  title: string | null;
  status: "active" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsState {
  // All projects
  projects: Project[];
  // Current project
  currentProjectId: string | null;
  currentProject: Project | null;
  // Project sessions
  projectSessions: Record<string, ProjectSession[]>;
  currentProjectSessionTotal: number;
  // Filter/search
  searchQuery: string;
  filterStatus: ProjectStatus | "all";
  filterType: ProjectType | "all";
  sortBy: "name" | "createdAt" | "updatedAt" | "lastActivityAt";
  sortOrder: "asc" | "desc";
  // View state
  viewMode: "grid" | "list";
  // Loading states
  isLoading: boolean;
  isLoadingSessions: boolean;
  isCreating: boolean;
  // Creation/edit flow
  editingProject: Partial<Project> | null;
  // Error state
  error: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  currentProjectId: null,
  currentProject: null,
  projectSessions: {},
  currentProjectSessionTotal: 0,
  searchQuery: "",
  filterStatus: "all",
  filterType: "all",
  sortBy: "updatedAt",
  sortOrder: "desc",
  viewMode: "grid",
  isLoading: false,
  isLoadingSessions: false,
  isCreating: false,
  editingProject: null,
  error: null,
};

export const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    // Set all projects
    setProjects: (state, action: PayloadAction<Project[]>) => {
      state.projects = action.payload;
      state.isLoading = false;
    },

    // Add a new project
    addProject: (state, action: PayloadAction<Project>) => {
      state.projects.unshift(action.payload);
      state.isCreating = false;
      state.editingProject = null;
    },

    // Update a project
    updateProject: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Project> }>
    ) => {
      const index = state.projects.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = {
          ...state.projects[index],
          ...action.payload.updates,
          updatedAt: new Date().toISOString(),
        };
        if (state.currentProjectId === action.payload.id) {
          state.currentProject = state.projects[index];
        }
      }
    },

    // Delete a project
    deleteProject: (state, action: PayloadAction<string>) => {
      state.projects = state.projects.filter((p) => p.id !== action.payload);
      delete state.projectSessions[action.payload];
      if (state.currentProjectId === action.payload) {
        state.currentProjectId = null;
        state.currentProject = null;
      }
    },

    // Archive a project
    archiveProject: (state, action: PayloadAction<string>) => {
      const project = state.projects.find((p) => p.id === action.payload);
      if (project) {
        project.status = "archived";
        project.updatedAt = new Date().toISOString();
      }
    },

    // Restore a project
    restoreProject: (state, action: PayloadAction<string>) => {
      const project = state.projects.find((p) => p.id === action.payload);
      if (project) {
        project.status = "active";
        project.updatedAt = new Date().toISOString();
      }
    },

    // Set current project
    setCurrentProject: (state, action: PayloadAction<string | null>) => {
      state.currentProjectId = action.payload;
      state.currentProject =
        state.projects.find((p) => p.id === action.payload) || null;
    },

    // Set project sessions
    setProjectSessions: (
      state,
      action: PayloadAction<{
        projectId: string;
        sessions: ProjectSession[];
        total: number;
      }>
    ) => {
      state.projectSessions[action.payload.projectId] = action.payload.sessions;
      if (state.currentProjectId === action.payload.projectId) {
        state.currentProjectSessionTotal = action.payload.total;
      }
      state.isLoadingSessions = false;
    },

    // Add a session to a project
    addProjectSession: (state, action: PayloadAction<ProjectSession>) => {
      const { projectId } = action.payload;
      if (!state.projectSessions[projectId]) {
        state.projectSessions[projectId] = [];
      }
      state.projectSessions[projectId].unshift(action.payload);

      // Update project session count
      const project = state.projects.find((p) => p.id === projectId);
      if (project) {
        project.sessionCount += 1;
        project.lastActivityAt = new Date().toISOString();
      }
    },

    // Project members management
    addProjectMember: (
      state,
      action: PayloadAction<{ projectId: string; member: ProjectMember }>
    ) => {
      const project = state.projects.find(
        (p) => p.id === action.payload.projectId
      );
      if (project) {
        project.members.push(action.payload.member);
      }
    },

    updateProjectMember: (
      state,
      action: PayloadAction<{
        projectId: string;
        userId: string;
        updates: Partial<ProjectMember>;
      }>
    ) => {
      const project = state.projects.find(
        (p) => p.id === action.payload.projectId
      );
      if (project) {
        const memberIndex = project.members.findIndex(
          (m) => m.userId === action.payload.userId
        );
        if (memberIndex !== -1) {
          project.members[memberIndex] = {
            ...project.members[memberIndex],
            ...action.payload.updates,
          };
        }
      }
    },

    removeProjectMember: (
      state,
      action: PayloadAction<{ projectId: string; userId: string }>
    ) => {
      const project = state.projects.find(
        (p) => p.id === action.payload.projectId
      );
      if (project) {
        project.members = project.members.filter(
          (m) => m.userId !== action.payload.userId
        );
      }
    },

    // Filter and search
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },

    setFilterStatus: (state, action: PayloadAction<ProjectStatus | "all">) => {
      state.filterStatus = action.payload;
    },

    setFilterType: (state, action: PayloadAction<ProjectType | "all">) => {
      state.filterType = action.payload;
    },

    setSortBy: (
      state,
      action: PayloadAction<
        "name" | "createdAt" | "updatedAt" | "lastActivityAt"
      >
    ) => {
      state.sortBy = action.payload;
    },

    setSortOrder: (state, action: PayloadAction<"asc" | "desc">) => {
      state.sortOrder = action.payload;
    },

    // View mode
    setViewMode: (state, action: PayloadAction<"grid" | "list">) => {
      state.viewMode = action.payload;
    },

    // Creation/edit flow
    startCreatingProject: (state) => {
      state.isCreating = true;
      state.editingProject = {
        type: "general",
        status: "active",
        settings: {
          isPublic: false,
          allowComments: true,
          notifyOnUpdate: true,
        },
        members: [],
      };
    },

    startEditingProject: (state, action: PayloadAction<string>) => {
      const project = state.projects.find((p) => p.id === action.payload);
      if (project) {
        state.editingProject = { ...project };
      }
    },

    updateEditingProject: (
      state,
      action: PayloadAction<Partial<Project>>
    ) => {
      if (state.editingProject) {
        state.editingProject = { ...state.editingProject, ...action.payload };
      }
    },

    cancelEditingProject: (state) => {
      state.editingProject = null;
      state.isCreating = false;
    },

    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setLoadingSessions: (state, action: PayloadAction<boolean>) => {
      state.isLoadingSessions = action.payload;
    },

    setCreating: (state, action: PayloadAction<boolean>) => {
      state.isCreating = action.payload;
    },

    // Error handling
    setProjectsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.isLoadingSessions = false;
      state.isCreating = false;
    },

    // Clear project state
    clearProjectsState: (state) => {
      state.currentProjectId = null;
      state.currentProject = null;
      state.projectSessions = {};
      state.currentProjectSessionTotal = 0;
    },
  },
});

export const {
  setProjects,
  addProject,
  updateProject,
  deleteProject,
  archiveProject,
  restoreProject,
  setCurrentProject,
  setProjectSessions,
  addProjectSession,
  addProjectMember,
  updateProjectMember,
  removeProjectMember,
  setSearchQuery,
  setFilterStatus,
  setFilterType,
  setSortBy,
  setSortOrder,
  setViewMode,
  startCreatingProject,
  startEditingProject,
  updateEditingProject,
  cancelEditingProject,
  setLoading,
  setLoadingSessions,
  setCreating,
  setProjectsError,
  clearProjectsState,
} = projectsSlice.actions;

export default projectsSlice.reducer;
