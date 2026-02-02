import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type DocumentType =
  | "document"
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "code"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "other";

export type AttachmentSource = "upload" | "web" | "connector" | "agent";

export interface AttachmentMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pageCount?: number;
  wordCount?: number;
  encoding?: string;
  language?: string;
  [key: string]: unknown;
}

export interface Attachment {
  id: string;
  userId: string;
  sessionId?: string;
  projectId?: string;
  groupId?: string;
  // File info
  name: string;
  description?: string;
  mimeType: string;
  size: number;
  docType: DocumentType;
  source: AttachmentSource;
  // Storage
  storageKey: string;
  storageProvider: "local" | "s3" | "r2" | "vercel_blob";
  url?: string;
  thumbnailUrl?: string;
  // Processing
  isProcessed: boolean;
  isIndexed: boolean; // For vector search
  processingStatus?: "pending" | "processing" | "completed" | "failed";
  processingError?: string;
  // Extracted content
  extractedText?: string;
  summary?: string;
  // Metadata
  metadata?: AttachmentMetadata;
  tags?: string[];
  isFavorite: boolean;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentGroup {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  attachmentCount: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBase {
  id: string;
  userId: string;
  teamId?: string;
  name: string;
  description?: string;
  // Configuration
  settings: {
    autoIndex: boolean;
    chunkSize: number;
    chunkOverlap: number;
    embeddingModel: string;
  };
  // Stats
  documentCount: number;
  totalSize: number;
  lastIndexedAt?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeState {
  // Attachments (library items)
  attachments: Attachment[];
  attachmentTotal: number;
  // Attachment groups/folders
  groups: AttachmentGroup[];
  groupsTotal: number;
  // Knowledge bases
  knowledgeBases: KnowledgeBase[];
  currentKnowledgeBaseId: string | null;
  // View state
  viewType: "grid" | "list";
  filterDocType: DocumentType | "all";
  isFavoriteFilter: boolean;
  searchValue: string;
  sortBy: "name" | "createdAt" | "size" | "type";
  sortOrder: "asc" | "desc";
  // Selection
  selectedAttachmentIds: string[];
  selectedGroupId: string | null;
  // Upload state
  uploadQueue: Array<{
    id: string;
    file: string; // File name
    progress: number;
    status: "pending" | "uploading" | "processing" | "completed" | "error";
    error?: string;
  }>;
  // Loading states
  isLoadingAttachments: boolean;
  isLoadingGroups: boolean;
  isLoadingKnowledgeBases: boolean;
  isUploading: boolean;
  // Error state
  error: string | null;
}

const initialState: KnowledgeState = {
  attachments: [],
  attachmentTotal: 0,
  groups: [],
  groupsTotal: 0,
  knowledgeBases: [],
  currentKnowledgeBaseId: null,
  viewType: "grid",
  filterDocType: "all",
  isFavoriteFilter: false,
  searchValue: "",
  sortBy: "createdAt",
  sortOrder: "desc",
  selectedAttachmentIds: [],
  selectedGroupId: null,
  uploadQueue: [],
  isLoadingAttachments: false,
  isLoadingGroups: false,
  isLoadingKnowledgeBases: false,
  isUploading: false,
  error: null,
};

export const knowledgeSlice = createSlice({
  name: "knowledge",
  initialState,
  reducers: {
    // Set attachments
    setAttachments: (
      state,
      action: PayloadAction<{ attachments: Attachment[]; total: number }>
    ) => {
      state.attachments = action.payload.attachments;
      state.attachmentTotal = action.payload.total;
      state.isLoadingAttachments = false;
    },

    // Append attachments (pagination)
    appendAttachments: (state, action: PayloadAction<Attachment[]>) => {
      state.attachments = [...state.attachments, ...action.payload];
    },

    // Add a single attachment
    addAttachment: (state, action: PayloadAction<Attachment>) => {
      state.attachments.unshift(action.payload);
      state.attachmentTotal += 1;
    },

    // Update an attachment
    updateAttachment: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Attachment> }>
    ) => {
      const index = state.attachments.findIndex(
        (a) => a.id === action.payload.id
      );
      if (index !== -1) {
        state.attachments[index] = {
          ...state.attachments[index],
          ...action.payload.updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    // Delete an attachment
    deleteAttachment: (state, action: PayloadAction<string>) => {
      state.attachments = state.attachments.filter(
        (a) => a.id !== action.payload
      );
      state.attachmentTotal = Math.max(0, state.attachmentTotal - 1);
      state.selectedAttachmentIds = state.selectedAttachmentIds.filter(
        (id) => id !== action.payload
      );
    },

    // Delete multiple attachments
    deleteAttachments: (state, action: PayloadAction<string[]>) => {
      state.attachments = state.attachments.filter(
        (a) => !action.payload.includes(a.id)
      );
      state.attachmentTotal = Math.max(
        0,
        state.attachmentTotal - action.payload.length
      );
      state.selectedAttachmentIds = state.selectedAttachmentIds.filter(
        (id) => !action.payload.includes(id)
      );
    },

    // Toggle favorite
    toggleAttachmentFavorite: (state, action: PayloadAction<string>) => {
      const attachment = state.attachments.find((a) => a.id === action.payload);
      if (attachment) {
        attachment.isFavorite = !attachment.isFavorite;
      }
    },

    // Set groups
    setGroups: (
      state,
      action: PayloadAction<{ groups: AttachmentGroup[]; total: number }>
    ) => {
      state.groups = action.payload.groups;
      state.groupsTotal = action.payload.total;
      state.isLoadingGroups = false;
    },

    // Add a group
    addGroup: (state, action: PayloadAction<AttachmentGroup>) => {
      state.groups.push(action.payload);
      state.groupsTotal += 1;
    },

    // Update a group
    updateGroup: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<AttachmentGroup> }>
    ) => {
      const index = state.groups.findIndex((g) => g.id === action.payload.id);
      if (index !== -1) {
        state.groups[index] = {
          ...state.groups[index],
          ...action.payload.updates,
        };
      }
    },

    // Delete a group
    deleteGroup: (state, action: PayloadAction<string>) => {
      state.groups = state.groups.filter((g) => g.id !== action.payload);
      state.groupsTotal = Math.max(0, state.groupsTotal - 1);
      if (state.selectedGroupId === action.payload) {
        state.selectedGroupId = null;
      }
    },

    // Set knowledge bases
    setKnowledgeBases: (state, action: PayloadAction<KnowledgeBase[]>) => {
      state.knowledgeBases = action.payload;
      state.isLoadingKnowledgeBases = false;
    },

    // Add a knowledge base
    addKnowledgeBase: (state, action: PayloadAction<KnowledgeBase>) => {
      state.knowledgeBases.push(action.payload);
    },

    // Update a knowledge base
    updateKnowledgeBase: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<KnowledgeBase> }>
    ) => {
      const index = state.knowledgeBases.findIndex(
        (kb) => kb.id === action.payload.id
      );
      if (index !== -1) {
        state.knowledgeBases[index] = {
          ...state.knowledgeBases[index],
          ...action.payload.updates,
        };
      }
    },

    // Delete a knowledge base
    deleteKnowledgeBase: (state, action: PayloadAction<string>) => {
      state.knowledgeBases = state.knowledgeBases.filter(
        (kb) => kb.id !== action.payload
      );
      if (state.currentKnowledgeBaseId === action.payload) {
        state.currentKnowledgeBaseId = null;
      }
    },

    // Set current knowledge base
    setCurrentKnowledgeBase: (state, action: PayloadAction<string | null>) => {
      state.currentKnowledgeBaseId = action.payload;
    },

    // View state
    setViewType: (state, action: PayloadAction<"grid" | "list">) => {
      state.viewType = action.payload;
    },

    setFilterDocType: (state, action: PayloadAction<DocumentType | "all">) => {
      state.filterDocType = action.payload;
    },

    setFavoriteFilter: (state, action: PayloadAction<boolean>) => {
      state.isFavoriteFilter = action.payload;
    },

    setSearchValue: (state, action: PayloadAction<string>) => {
      state.searchValue = action.payload;
    },

    setSortBy: (
      state,
      action: PayloadAction<"name" | "createdAt" | "size" | "type">
    ) => {
      state.sortBy = action.payload;
    },

    setSortOrder: (state, action: PayloadAction<"asc" | "desc">) => {
      state.sortOrder = action.payload;
    },

    // Selection
    setSelectedAttachments: (state, action: PayloadAction<string[]>) => {
      state.selectedAttachmentIds = action.payload;
    },

    toggleAttachmentSelection: (state, action: PayloadAction<string>) => {
      const index = state.selectedAttachmentIds.indexOf(action.payload);
      if (index === -1) {
        state.selectedAttachmentIds.push(action.payload);
      } else {
        state.selectedAttachmentIds.splice(index, 1);
      }
    },

    clearSelection: (state) => {
      state.selectedAttachmentIds = [];
    },

    setSelectedGroup: (state, action: PayloadAction<string | null>) => {
      state.selectedGroupId = action.payload;
    },

    // Upload queue
    addToUploadQueue: (
      state,
      action: PayloadAction<{ id: string; file: string }>
    ) => {
      state.uploadQueue.push({
        id: action.payload.id,
        file: action.payload.file,
        progress: 0,
        status: "pending",
      });
    },

    updateUploadProgress: (
      state,
      action: PayloadAction<{
        id: string;
        progress: number;
        status?: "pending" | "uploading" | "processing" | "completed" | "error";
        error?: string;
      }>
    ) => {
      const item = state.uploadQueue.find((u) => u.id === action.payload.id);
      if (item) {
        item.progress = action.payload.progress;
        if (action.payload.status) {
          item.status = action.payload.status;
        }
        if (action.payload.error) {
          item.error = action.payload.error;
        }
      }
    },

    removeFromUploadQueue: (state, action: PayloadAction<string>) => {
      state.uploadQueue = state.uploadQueue.filter(
        (u) => u.id !== action.payload
      );
    },

    clearUploadQueue: (state) => {
      state.uploadQueue = [];
      state.isUploading = false;
    },

    // Loading states
    setLoadingAttachments: (state, action: PayloadAction<boolean>) => {
      state.isLoadingAttachments = action.payload;
    },

    setLoadingGroups: (state, action: PayloadAction<boolean>) => {
      state.isLoadingGroups = action.payload;
    },

    setLoadingKnowledgeBases: (state, action: PayloadAction<boolean>) => {
      state.isLoadingKnowledgeBases = action.payload;
    },

    setUploading: (state, action: PayloadAction<boolean>) => {
      state.isUploading = action.payload;
    },

    // Error handling
    setKnowledgeError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoadingAttachments = false;
      state.isLoadingGroups = false;
      state.isLoadingKnowledgeBases = false;
      state.isUploading = false;
    },

    // Clear state
    clearKnowledgeState: (state) => {
      state.attachments = [];
      state.attachmentTotal = 0;
      state.groups = [];
      state.groupsTotal = 0;
      state.selectedAttachmentIds = [];
      state.selectedGroupId = null;
      state.uploadQueue = [];
    },
  },
});

export const {
  setAttachments,
  appendAttachments,
  addAttachment,
  updateAttachment,
  deleteAttachment,
  deleteAttachments,
  toggleAttachmentFavorite,
  setGroups,
  addGroup,
  updateGroup,
  deleteGroup,
  setKnowledgeBases,
  addKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  setCurrentKnowledgeBase,
  setViewType,
  setFilterDocType,
  setFavoriteFilter,
  setSearchValue,
  setSortBy,
  setSortOrder,
  setSelectedAttachments,
  toggleAttachmentSelection,
  clearSelection,
  setSelectedGroup,
  addToUploadQueue,
  updateUploadProgress,
  removeFromUploadQueue,
  clearUploadQueue,
  setLoadingAttachments,
  setLoadingGroups,
  setLoadingKnowledgeBases,
  setUploading,
  setKnowledgeError,
  clearKnowledgeState,
} = knowledgeSlice.actions;

export default knowledgeSlice.reducer;
