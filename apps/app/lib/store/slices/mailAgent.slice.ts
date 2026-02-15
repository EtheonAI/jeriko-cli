import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Mail Agent Slice
 * Manages email agent functionality (Manus-style mailManus)
 */

export type EmailType = 0 | 1 | 2; // 0: default, 1: custom, 2: disabled

export interface AgentEmailInfo {
  email: string;
  prompt: string;
  emailType: EmailType;
  canEditAgentEmail: boolean;
  createdAt: string;
  canEditTime: string;
}

export interface AgentEmailWhiteListInfo {
  email: string;
  createdAt: string;
}

export interface AgentSubEmail {
  id: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
}

export interface UnknownEmail {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  isRead: boolean;
}

export type MailAgentTab = "settings" | "whitelist" | "subemails" | "unknown";

export interface MailAgentState {
  // Agent email configuration
  agentEmailInfo: AgentEmailInfo | null;

  // Whitelist
  emailWhiteList: AgentEmailWhiteListInfo[];

  // Edit permissions
  canEditAgentEmail: boolean;
  canEditTime: string | null;

  // Sub-emails
  agentSubEmails: AgentSubEmail[];

  // Unknown emails (emails from non-whitelisted senders)
  unknownEmails: UnknownEmail[];
  hasUnreadUnknownEmail: boolean;

  // UI State
  initTab: MailAgentTab;
  currentTab: MailAgentTab;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  isAddingToWhitelist: boolean;
  isRemovingFromWhitelist: boolean;

  // Editing
  isEditingEmail: boolean;
  editedEmail: string;
  editedPrompt: string;

  // Error
  error: string | null;
}

const initialState: MailAgentState = {
  agentEmailInfo: null,
  emailWhiteList: [],
  canEditAgentEmail: true,
  canEditTime: null,
  agentSubEmails: [],
  unknownEmails: [],
  hasUnreadUnknownEmail: false,
  initTab: "settings",
  currentTab: "settings",
  isLoading: false,
  isSaving: false,
  isAddingToWhitelist: false,
  isRemovingFromWhitelist: false,
  isEditingEmail: false,
  editedEmail: "",
  editedPrompt: "",
  error: null,
};

export const mailAgentSlice = createSlice({
  name: "mailAgent",
  initialState,
  reducers: {
    // Agent email info
    setAgentEmailInfo: (state, action: PayloadAction<AgentEmailInfo | null>) => {
      state.agentEmailInfo = action.payload;
      state.isLoading = false;
      if (action.payload) {
        state.canEditAgentEmail = action.payload.canEditAgentEmail;
        state.canEditTime = action.payload.canEditTime;
      }
    },

    updateAgentEmailInfo: (state, action: PayloadAction<Partial<AgentEmailInfo>>) => {
      if (state.agentEmailInfo) {
        state.agentEmailInfo = { ...state.agentEmailInfo, ...action.payload };
      }
    },

    // Whitelist
    setEmailWhiteList: (state, action: PayloadAction<AgentEmailWhiteListInfo[]>) => {
      state.emailWhiteList = action.payload;
    },

    addToWhitelist: (state, action: PayloadAction<AgentEmailWhiteListInfo>) => {
      state.emailWhiteList.push(action.payload);
      state.isAddingToWhitelist = false;
    },

    removeFromWhitelist: (state, action: PayloadAction<string>) => {
      state.emailWhiteList = state.emailWhiteList.filter((e) => e.email !== action.payload);
      state.isRemovingFromWhitelist = false;
    },

    setIsAddingToWhitelist: (state, action: PayloadAction<boolean>) => {
      state.isAddingToWhitelist = action.payload;
    },

    setIsRemovingFromWhitelist: (state, action: PayloadAction<boolean>) => {
      state.isRemovingFromWhitelist = action.payload;
    },

    // Edit permissions
    setCanEditAgentEmail: (state, action: PayloadAction<boolean>) => {
      state.canEditAgentEmail = action.payload;
    },

    setCanEditTime: (state, action: PayloadAction<string | null>) => {
      state.canEditTime = action.payload;
    },

    // Sub-emails
    setAgentSubEmails: (state, action: PayloadAction<AgentSubEmail[]>) => {
      state.agentSubEmails = action.payload;
    },

    addSubEmail: (state, action: PayloadAction<AgentSubEmail>) => {
      state.agentSubEmails.push(action.payload);
    },

    removeSubEmail: (state, action: PayloadAction<string>) => {
      state.agentSubEmails = state.agentSubEmails.filter((e) => e.id !== action.payload);
    },

    verifySubEmail: (state, action: PayloadAction<string>) => {
      const email = state.agentSubEmails.find((e) => e.id === action.payload);
      if (email) {
        email.isVerified = true;
      }
    },

    // Unknown emails
    setUnknownEmails: (state, action: PayloadAction<UnknownEmail[]>) => {
      state.unknownEmails = action.payload;
      state.hasUnreadUnknownEmail = action.payload.some((e) => !e.isRead);
    },

    markUnknownEmailAsRead: (state, action: PayloadAction<string>) => {
      const email = state.unknownEmails.find((e) => e.id === action.payload);
      if (email) {
        email.isRead = true;
      }
      state.hasUnreadUnknownEmail = state.unknownEmails.some((e) => !e.isRead);
    },

    setHasUnreadUnknownEmail: (state, action: PayloadAction<boolean>) => {
      state.hasUnreadUnknownEmail = action.payload;
    },

    // Tabs
    setInitTab: (state, action: PayloadAction<MailAgentTab>) => {
      state.initTab = action.payload;
      state.currentTab = action.payload;
    },

    setCurrentTab: (state, action: PayloadAction<MailAgentTab>) => {
      state.currentTab = action.payload;
    },

    // Loading
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setIsSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    },

    // Editing
    startEditingEmail: (state) => {
      state.isEditingEmail = true;
      state.editedEmail = state.agentEmailInfo?.email || "";
      state.editedPrompt = state.agentEmailInfo?.prompt || "";
    },

    cancelEditingEmail: (state) => {
      state.isEditingEmail = false;
      state.editedEmail = "";
      state.editedPrompt = "";
    },

    setEditedEmail: (state, action: PayloadAction<string>) => {
      state.editedEmail = action.payload;
    },

    setEditedPrompt: (state, action: PayloadAction<string>) => {
      state.editedPrompt = action.payload;
    },

    saveEmailEdits: (state) => {
      if (state.agentEmailInfo) {
        state.agentEmailInfo.email = state.editedEmail;
        state.agentEmailInfo.prompt = state.editedPrompt;
      }
      state.isEditingEmail = false;
      state.isSaving = false;
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.isSaving = false;
    },

    // Reset
    resetMailAgent: (state) => {
      Object.assign(state, initialState);
    },
  },
  extraReducers: (builder) => {
    // Manus compatibility (mailManus slice name)
    builder.addCase("mailManus/setAgentEmailInfo", (state, action) => {
      const payload = (action as any).payload;
      state.agentEmailInfo = payload ?? null;
      state.isLoading = false;
      if (payload) {
        state.canEditAgentEmail = payload.canEditAgentEmail;
        state.canEditTime = payload.canEditTime;
      }
    });
    builder.addCase("mailManus/setEmailWhiteList", (state, action) => {
      state.emailWhiteList = (action as any).payload ?? [];
    });
    builder.addCase("mailManus/setCanEditAgentEmail", (state, action) => {
      state.canEditAgentEmail = (action as any).payload ?? false;
    });
    builder.addCase("mailManus/setCanEditTime", (state, action) => {
      state.canEditTime = (action as any).payload ?? null;
    });
    builder.addCase("mailManus/setAgentSubEmails", (state, action) => {
      state.agentSubEmails = (action as any).payload ?? [];
    });
  },
});

export const {
  setAgentEmailInfo,
  updateAgentEmailInfo,
  setEmailWhiteList,
  addToWhitelist,
  removeFromWhitelist,
  setIsAddingToWhitelist,
  setIsRemovingFromWhitelist,
  setCanEditAgentEmail,
  setCanEditTime,
  setAgentSubEmails,
  addSubEmail,
  removeSubEmail,
  verifySubEmail,
  setUnknownEmails,
  markUnknownEmailAsRead,
  setHasUnreadUnknownEmail,
  setInitTab,
  setCurrentTab,
  setIsLoading,
  setIsSaving,
  startEditingEmail,
  cancelEditingEmail,
  setEditedEmail,
  setEditedPrompt,
  saveEmailEdits,
  setError,
  resetMailAgent,
} = mailAgentSlice.actions;

export default mailAgentSlice.reducer;
