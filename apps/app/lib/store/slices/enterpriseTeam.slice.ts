import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Enterprise Team Slice
 * Enterprise-specific team features: API key management and audit logs.
 */

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  createdBy: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  actorEmail: string;
  target: string;
  targetType: string;
  details: Record<string, unknown>;
  ipAddress: string;
  timestamp: string;
}

export interface EnterpriseTeamState {
  // API Keys
  apiKeys: ApiKey[] | null;
  apiKeysLoading: boolean;

  // Audit Logs
  auditLogs: AuditLogEntry[] | null;
  auditLogsLoading: boolean;
  auditLogsCursor: string | null;
  auditLogsHasMore: boolean;

  // Error
  error: string | null;
}

const initialState: EnterpriseTeamState = {
  apiKeys: null,
  apiKeysLoading: false,
  auditLogs: null,
  auditLogsLoading: false,
  auditLogsCursor: null,
  auditLogsHasMore: false,
  error: null,
};

const enterpriseTeamSlice = createSlice({
  name: "enterpriseTeam",
  initialState,
  reducers: {
    // API Keys
    setApiKeys: (state, action: PayloadAction<ApiKey[] | null>) => {
      state.apiKeys = action.payload;
      state.apiKeysLoading = false;
    },

    addApiKey: (state, action: PayloadAction<ApiKey>) => {
      if (state.apiKeys) {
        state.apiKeys.push(action.payload);
      } else {
        state.apiKeys = [action.payload];
      }
    },

    removeApiKey: (state, action: PayloadAction<string>) => {
      if (state.apiKeys) {
        state.apiKeys = state.apiKeys.filter((k) => k.id !== action.payload);
      }
    },

    setApiKeysLoading: (state, action: PayloadAction<boolean>) => {
      state.apiKeysLoading = action.payload;
    },

    // Audit Logs
    setAuditLogs: (state, action: PayloadAction<AuditLogEntry[] | null>) => {
      state.auditLogs = action.payload;
      state.auditLogsLoading = false;
    },

    appendAuditLogs: (
      state,
      action: PayloadAction<{
        logs: AuditLogEntry[];
        cursor: string | null;
        hasMore: boolean;
      }>
    ) => {
      if (state.auditLogs) {
        state.auditLogs = [...state.auditLogs, ...action.payload.logs];
      } else {
        state.auditLogs = action.payload.logs;
      }
      state.auditLogsCursor = action.payload.cursor;
      state.auditLogsHasMore = action.payload.hasMore;
      state.auditLogsLoading = false;
    },

    setAuditLogsLoading: (state, action: PayloadAction<boolean>) => {
      state.auditLogsLoading = action.payload;
    },

    // Error
    setEnterpriseTeamError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.apiKeysLoading = false;
      state.auditLogsLoading = false;
    },

    // Reset
    resetEnterpriseTeam: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setApiKeys,
  addApiKey,
  removeApiKey,
  setApiKeysLoading,
  setAuditLogs,
  appendAuditLogs,
  setAuditLogsLoading,
  setEnterpriseTeamError,
  resetEnterpriseTeam,
} = enterpriseTeamSlice.actions;

export default enterpriseTeamSlice.reducer;
