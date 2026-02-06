import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Language = "en" | "zh" | "es" | "fr" | "de" | "ja" | "ko" | "pt" | "ru" | "ar";

export interface AgentConfig {
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  tools: string[];
  capabilities: string[];
}

export interface ChatConfig {
  streamingEnabled: boolean;
  autoScroll: boolean;
  showTimestamps: boolean;
  showToolCalls: boolean;
  showTokenUsage: boolean;
  codeHighlighting: boolean;
  markdownRendering: boolean;
}

export interface NotificationConfig {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  emailEnabled: boolean;
  taskComplete: boolean;
  taskFailed: boolean;
  mentions: boolean;
}

export interface PrivacyConfig {
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;
  personalizationEnabled: boolean;
  shareUsageData: boolean;
}

export interface AccessibilityConfig {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: "small" | "medium" | "large" | "xlarge";
  keyboardShortcutsEnabled: boolean;
}

export interface KeyboardShortcut {
  id: string;
  action: string;
  keys: string[];
  enabled: boolean;
  customizable: boolean;
}

export interface ClientConfig {
  // Basic settings
  language: Language;
  timezone: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  // Agent settings
  agent: AgentConfig;
  // Chat settings
  chat: ChatConfig;
  // Notification settings
  notifications: NotificationConfig;
  // Privacy settings
  privacy: PrivacyConfig;
  // Accessibility settings
  accessibility: AccessibilityConfig;
  // Keyboard shortcuts
  keyboardShortcuts: KeyboardShortcut[];
  // Storage quota
  storageQuota: {
    used: number;
    total: number;
    unit: "MB" | "GB";
  };
  // Rate limits
  rateLimits: {
    requestsPerMinute: number;
    tokensPerDay: number;
    tokensUsedToday: number;
  };
}

export interface InvitationCode {
  code: string;
  type: "team" | "beta" | "referral";
  expiresAt?: string;
  usedAt?: string;
  usesRemaining?: number;
}

export interface AgentEmailInfo {
  email: string;
  prompt?: string;
  emailType: number;
  canEditAgentEmail: boolean;
  createdAt: string;
  canEditTime?: string;
}

export interface ConfigsState {
  // Client configuration
  clientConfig: ClientConfig | null;
  // Invitation codes
  invitationCodes: InvitationCode[];
  invitationCodeLength: number | null;
  // Agent email (like Manus bot email)
  agentEmailInfo: AgentEmailInfo | null;
  emailWhiteList: Array<{
    email: string;
    createdAt: string;
  }>;
  // Feature availability
  features: {
    mapReduceEnabled: boolean;
    freeMapReduceCount: number;
    webDevEnabled: boolean;
    aiCanvasEnabled: boolean;
    slideEditorEnabled: boolean;
    scheduledTasksEnabled: boolean;
    teamEnabled: boolean;
    connectorLimit: number;
    storageLimit: number; // In GB
  };
  // Payment/subscription
  paymentInfo: {
    paymentDisabled: boolean;
    plan: "free" | "pro" | "enterprise";
    billingCycle?: "monthly" | "yearly";
    nextBillingDate?: string;
    paymentMethod?: {
      type: "card" | "paypal";
      last4?: string;
      expiresAt?: string;
    };
  } | null;
  // Loading states
  isLoading: boolean;
  isUpdating: boolean;
  // Initialization
  isInitialized: boolean;
  // Error state
  error: string | null;
}

const defaultClientConfig: ClientConfig = {
  language: "en",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
  agent: {
    defaultModel: "claude-3-opus",
    temperature: 0.7,
    maxTokens: 4096,
    tools: [],
    capabilities: [],
  },
  chat: {
    streamingEnabled: true,
    autoScroll: true,
    showTimestamps: true,
    showToolCalls: true,
    showTokenUsage: false,
    codeHighlighting: true,
    markdownRendering: true,
  },
  notifications: {
    soundEnabled: true,
    desktopEnabled: true,
    emailEnabled: true,
    taskComplete: true,
    taskFailed: true,
    mentions: true,
  },
  privacy: {
    analyticsEnabled: true,
    crashReportingEnabled: true,
    personalizationEnabled: true,
    shareUsageData: false,
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    fontSize: "medium",
    keyboardShortcutsEnabled: true,
  },
  keyboardShortcuts: [],
  storageQuota: {
    used: 0,
    total: 5,
    unit: "GB",
  },
  rateLimits: {
    requestsPerMinute: 60,
    tokensPerDay: 100000,
    tokensUsedToday: 0,
  },
};

const initialState: ConfigsState = {
  clientConfig: null,
  invitationCodes: [],
  invitationCodeLength: null,
  agentEmailInfo: null,
  emailWhiteList: [],
  features: {
    mapReduceEnabled: false,
    freeMapReduceCount: 0,
    webDevEnabled: true,
    aiCanvasEnabled: true,
    slideEditorEnabled: true,
    scheduledTasksEnabled: true,
    teamEnabled: true,
    connectorLimit: 10,
    storageLimit: 5,
  },
  paymentInfo: null,
  isLoading: false,
  isUpdating: false,
  isInitialized: false,
  error: null,
};

export const configsSlice = createSlice({
  name: "configs",
  initialState,
  reducers: {
    // Initialize configs
    initializeConfigs: (
      state,
      action: PayloadAction<{
        clientConfig?: Partial<ClientConfig>;
        features?: Partial<ConfigsState["features"]>;
        paymentInfo?: ConfigsState["paymentInfo"];
        agentEmailInfo?: AgentEmailInfo | null;
        invitationCodes?: InvitationCode[];
      }>
    ) => {
      state.clientConfig = {
        ...defaultClientConfig,
        ...(action.payload.clientConfig || {}),
      };
      if (action.payload.features) {
        state.features = { ...state.features, ...action.payload.features };
      }
      if (action.payload.paymentInfo) {
        state.paymentInfo = action.payload.paymentInfo;
      }
      if (action.payload.agentEmailInfo) {
        state.agentEmailInfo = action.payload.agentEmailInfo;
      }
      if (action.payload.invitationCodes) {
        state.invitationCodes = action.payload.invitationCodes;
      }
      state.isInitialized = true;
      state.isLoading = false;
    },

    // Set client config
    setClientConfig: (state, action: PayloadAction<ClientConfig>) => {
      state.clientConfig = action.payload;
    },

    // Update partial client config
    updateClientConfig: (state, action: PayloadAction<Partial<ClientConfig>>) => {
      if (state.clientConfig) {
        state.clientConfig = { ...state.clientConfig, ...action.payload };
      }
    },

    // Update agent config
    updateAgentConfig: (state, action: PayloadAction<Partial<AgentConfig>>) => {
      if (state.clientConfig) {
        state.clientConfig.agent = {
          ...state.clientConfig.agent,
          ...action.payload,
        };
      }
    },

    // Update chat config
    updateChatConfig: (state, action: PayloadAction<Partial<ChatConfig>>) => {
      if (state.clientConfig) {
        state.clientConfig.chat = {
          ...state.clientConfig.chat,
          ...action.payload,
        };
      }
    },

    // Update notification config
    updateNotificationConfig: (state, action: PayloadAction<Partial<NotificationConfig>>) => {
      if (state.clientConfig) {
        state.clientConfig.notifications = {
          ...state.clientConfig.notifications,
          ...action.payload,
        };
      }
    },

    // Update privacy config
    updatePrivacyConfig: (state, action: PayloadAction<Partial<PrivacyConfig>>) => {
      if (state.clientConfig) {
        state.clientConfig.privacy = {
          ...state.clientConfig.privacy,
          ...action.payload,
        };
      }
    },

    // Update accessibility config
    updateAccessibilityConfig: (state, action: PayloadAction<Partial<AccessibilityConfig>>) => {
      if (state.clientConfig) {
        state.clientConfig.accessibility = {
          ...state.clientConfig.accessibility,
          ...action.payload,
        };
      }
    },

    // Set language
    setLanguage: (state, action: PayloadAction<Language>) => {
      if (state.clientConfig) {
        state.clientConfig.language = action.payload;
      }
    },

    // Set timezone
    setTimezone: (state, action: PayloadAction<string>) => {
      if (state.clientConfig) {
        state.clientConfig.timezone = action.payload;
      }
    },

    // Keyboard shortcuts
    updateKeyboardShortcut: (state, action: PayloadAction<{ id: string; keys: string[] }>) => {
      if (state.clientConfig) {
        const shortcut = state.clientConfig.keyboardShortcuts.find(
          (s) => s.id === action.payload.id
        );
        if (shortcut) {
          shortcut.keys = action.payload.keys;
        }
      }
    },

    toggleKeyboardShortcut: (state, action: PayloadAction<string>) => {
      if (state.clientConfig) {
        const shortcut = state.clientConfig.keyboardShortcuts.find((s) => s.id === action.payload);
        if (shortcut) {
          shortcut.enabled = !shortcut.enabled;
        }
      }
    },

    // Storage quota
    updateStorageQuota: (state, action: PayloadAction<{ used: number; total?: number }>) => {
      if (state.clientConfig) {
        state.clientConfig.storageQuota.used = action.payload.used;
        if (action.payload.total !== undefined) {
          state.clientConfig.storageQuota.total = action.payload.total;
        }
      }
    },

    // Rate limits
    updateRateLimits: (state, action: PayloadAction<Partial<ClientConfig["rateLimits"]>>) => {
      if (state.clientConfig) {
        state.clientConfig.rateLimits = {
          ...state.clientConfig.rateLimits,
          ...action.payload,
        };
      }
    },

    // Invitation codes
    setInvitationCodes: (state, action: PayloadAction<InvitationCode[]>) => {
      state.invitationCodes = action.payload;
    },

    addInvitationCode: (state, action: PayloadAction<InvitationCode>) => {
      state.invitationCodes.push(action.payload);
    },

    // Agent email
    setAgentEmailInfo: (state, action: PayloadAction<AgentEmailInfo | null>) => {
      state.agentEmailInfo = action.payload;
    },

    updateAgentEmailInfo: (state, action: PayloadAction<Partial<AgentEmailInfo>>) => {
      if (state.agentEmailInfo) {
        state.agentEmailInfo = { ...state.agentEmailInfo, ...action.payload };
      }
    },

    setEmailWhiteList: (
      state,
      action: PayloadAction<Array<{ email: string; createdAt: string }>>
    ) => {
      state.emailWhiteList = action.payload;
    },

    addToEmailWhiteList: (state, action: PayloadAction<string>) => {
      state.emailWhiteList.push({
        email: action.payload,
        createdAt: new Date().toISOString(),
      });
    },

    removeFromEmailWhiteList: (state, action: PayloadAction<string>) => {
      state.emailWhiteList = state.emailWhiteList.filter((e) => e.email !== action.payload);
    },

    // Features
    setFeatures: (state, action: PayloadAction<Partial<ConfigsState["features"]>>) => {
      state.features = { ...state.features, ...action.payload };
    },

    // Payment info
    setPaymentInfo: (state, action: PayloadAction<ConfigsState["paymentInfo"]>) => {
      state.paymentInfo = action.payload;
    },

    updatePaymentInfo: (
      state,
      action: PayloadAction<Partial<NonNullable<ConfigsState["paymentInfo"]>>>
    ) => {
      if (state.paymentInfo) {
        state.paymentInfo = { ...state.paymentInfo, ...action.payload };
      }
    },

    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setUpdating: (state, action: PayloadAction<boolean>) => {
      state.isUpdating = action.payload;
    },

    // Error handling
    setConfigsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.isUpdating = false;
    },

    // Reset to defaults
    resetToDefaults: (state) => {
      state.clientConfig = { ...defaultClientConfig };
    },

    // Clear configs
    clearConfigsState: (state) => {
      state.clientConfig = null;
      state.invitationCodes = [];
      state.invitationCodeLength = null;
      state.agentEmailInfo = null;
      state.emailWhiteList = [];
      state.paymentInfo = null;
      state.isInitialized = false;
    },
  },
  extraReducers: (builder) => {
    // Manus compatibility
    builder.addCase("configs/setInvitationCodeLength", (state, action: PayloadAction<number>) => {
      state.invitationCodeLength = action.payload ?? null;
    });
  },
});

export const {
  initializeConfigs,
  setClientConfig,
  updateClientConfig,
  updateAgentConfig,
  updateChatConfig,
  updateNotificationConfig,
  updatePrivacyConfig,
  updateAccessibilityConfig,
  setLanguage,
  setTimezone,
  updateKeyboardShortcut,
  toggleKeyboardShortcut,
  updateStorageQuota,
  updateRateLimits,
  setInvitationCodes,
  addInvitationCode,
  setAgentEmailInfo,
  updateAgentEmailInfo,
  setEmailWhiteList,
  addToEmailWhiteList,
  removeFromEmailWhiteList,
  setFeatures,
  setPaymentInfo,
  updatePaymentInfo,
  setLoading,
  setUpdating,
  setConfigsError,
  resetToDefaults,
  clearConfigsState,
} = configsSlice.actions;

export default configsSlice.reducer;
