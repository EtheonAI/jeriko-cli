import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type TeamRole = "owner" | "admin" | "member" | "viewer" | "guest";
export type MemberStatus = "active" | "pending" | "suspended" | "removed";
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: TeamRole;
  status: MemberStatus;
  permissions: string[];
  invitedBy?: string;
  joinedAt: string;
  lastActiveAt?: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  status: InviteStatus;
  invitedBy: string;
  invitedByName: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatarUrl?: string;
  ownerId: string;
  // Subscription/billing
  plan: "free" | "pro" | "enterprise";
  memberLimit: number;
  // Settings
  settings: {
    allowMemberInvites: boolean;
    requireEmailVerification: boolean;
    defaultMemberRole: TeamRole;
    ssoEnabled: boolean;
    ssoDomain?: string;
  };
  // Stats
  memberCount: number;
  sessionCount: number;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface AccessControl {
  id: string;
  teamId: string;
  resourceType: "session" | "project" | "file" | "connector";
  resourceId: string;
  principalType: "user" | "team" | "role";
  principalId: string;
  permission: "view" | "edit" | "admin" | "full";
  grantedBy: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AssetShare {
  id: string;
  teamId: string;
  resourceType: string;
  resourceId: string;
  sharedWith: string[];
  permission: string;
  createdAt: string;
}

export interface SSOInfo {
  ssoId: string;
  enabled: boolean;
  expired: boolean;
  connection: boolean;
  domains: string[];
  memberAddPolicy: number;
  howMemberCanLogin: number;
}

export interface TeamState {
  // Current user's teams
  teams: Team[];
  // Currently selected team
  currentTeamId: string | null;
  currentTeam: Team | null;
  // Team members
  members: TeamMember[];
  // Pending invitations
  invitations: TeamInvitation[];
  // Access controls
  accessControls: AccessControl[];
  // Asset shares
  assetShareList: AssetShare[];
  // SSO configuration
  ssoInfo: SSOInfo | null;
  // Renewal settings
  renewalSettings: {
    autoRenew: boolean;
    nextBillingDate?: string;
    paymentMethod?: string;
  } | null;
  // SCIM unmanaged accounts
  scimUnmanagedAccounts: string[];
  // Loading states
  isLoadingTeams: boolean;
  isLoadingMembers: boolean;
  isLoadingInvitations: boolean;
  isLoadingSSO: boolean;
  isInviting: boolean;
  // Error state
  error: string | null;
}

const initialState: TeamState = {
  teams: [],
  currentTeamId: null,
  currentTeam: null,
  members: [],
  invitations: [],
  accessControls: [],
  assetShareList: [],
  ssoInfo: null,
  renewalSettings: null,
  scimUnmanagedAccounts: [],
  isLoadingTeams: false,
  isLoadingMembers: false,
  isLoadingInvitations: false,
  isLoadingSSO: false,
  isInviting: false,
  error: null,
};

export const teamSlice = createSlice({
  name: "team",
  initialState,
  reducers: {
    // Set teams list
    setTeams: (state, action: PayloadAction<Team[]>) => {
      state.teams = action.payload;
      state.isLoadingTeams = false;
    },

    // Add a new team
    addTeam: (state, action: PayloadAction<Team>) => {
      state.teams.push(action.payload);
    },

    // Update a team
    updateTeam: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Team> }>
    ) => {
      const index = state.teams.findIndex((t) => t.id === action.payload.id);
      if (index !== -1) {
        state.teams[index] = { ...state.teams[index], ...action.payload.updates };
        if (state.currentTeamId === action.payload.id) {
          state.currentTeam = state.teams[index];
        }
      }
    },

    // Delete a team
    deleteTeam: (state, action: PayloadAction<string>) => {
      state.teams = state.teams.filter((t) => t.id !== action.payload);
      if (state.currentTeamId === action.payload) {
        state.currentTeamId = null;
        state.currentTeam = null;
      }
    },

    // Set current team
    setCurrentTeam: (state, action: PayloadAction<string | null>) => {
      state.currentTeamId = action.payload;
      state.currentTeam =
        state.teams.find((t) => t.id === action.payload) || null;
    },

    // Set team members
    setMembers: (state, action: PayloadAction<TeamMember[]>) => {
      state.members = action.payload;
      state.isLoadingMembers = false;
    },

    // Add a member
    addMember: (state, action: PayloadAction<TeamMember>) => {
      state.members.push(action.payload);
      // Update member count on current team
      if (state.currentTeam) {
        state.currentTeam.memberCount += 1;
      }
    },

    // Update a member
    updateMember: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<TeamMember> }>
    ) => {
      const index = state.members.findIndex((m) => m.id === action.payload.id);
      if (index !== -1) {
        state.members[index] = {
          ...state.members[index],
          ...action.payload.updates,
        };
      }
    },

    // Remove a member
    removeMember: (state, action: PayloadAction<string>) => {
      state.members = state.members.filter((m) => m.id !== action.payload);
      // Update member count on current team
      if (state.currentTeam && state.currentTeam.memberCount > 0) {
        state.currentTeam.memberCount -= 1;
      }
    },

    // Update member role
    updateMemberRole: (
      state,
      action: PayloadAction<{ memberId: string; role: TeamRole }>
    ) => {
      const member = state.members.find((m) => m.id === action.payload.memberId);
      if (member) {
        member.role = action.payload.role;
      }
    },

    // Set invitations
    setInvitations: (state, action: PayloadAction<TeamInvitation[]>) => {
      state.invitations = action.payload;
      state.isLoadingInvitations = false;
    },

    // Add an invitation
    addInvitation: (state, action: PayloadAction<TeamInvitation>) => {
      state.invitations.push(action.payload);
      state.isInviting = false;
    },

    // Update invitation
    updateInvitation: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<TeamInvitation> }>
    ) => {
      const index = state.invitations.findIndex(
        (i) => i.id === action.payload.id
      );
      if (index !== -1) {
        state.invitations[index] = {
          ...state.invitations[index],
          ...action.payload.updates,
        };
      }
    },

    // Revoke invitation
    revokeInvitation: (state, action: PayloadAction<string>) => {
      const invitation = state.invitations.find((i) => i.id === action.payload);
      if (invitation) {
        invitation.status = "revoked";
      }
    },

    // Delete invitation
    deleteInvitation: (state, action: PayloadAction<string>) => {
      state.invitations = state.invitations.filter(
        (i) => i.id !== action.payload
      );
    },

    // Set access controls
    setAccessControls: (state, action: PayloadAction<AccessControl[]>) => {
      state.accessControls = action.payload;
    },

    // Add access control
    addAccessControl: (state, action: PayloadAction<AccessControl>) => {
      state.accessControls.push(action.payload);
    },

    // Remove access control
    removeAccessControl: (state, action: PayloadAction<string>) => {
      state.accessControls = state.accessControls.filter(
        (ac) => ac.id !== action.payload
      );
    },

    // Set asset shares
    setAssetShareList: (state, action: PayloadAction<AssetShare[]>) => {
      state.assetShareList = action.payload;
    },

    // SSO management
    setSSOInfo: (state, action: PayloadAction<SSOInfo | null>) => {
      state.ssoInfo = action.payload;
      state.isLoadingSSO = false;
    },

    // Renewal settings
    setRenewalSettings: (
      state,
      action: PayloadAction<TeamState["renewalSettings"]>
    ) => {
      state.renewalSettings = action.payload;
    },

    // SCIM accounts
    setScimUnmanagedAccounts: (state, action: PayloadAction<string[]>) => {
      state.scimUnmanagedAccounts = action.payload;
    },

    // Loading states
    setLoadingTeams: (state, action: PayloadAction<boolean>) => {
      state.isLoadingTeams = action.payload;
    },

    setLoadingMembers: (state, action: PayloadAction<boolean>) => {
      state.isLoadingMembers = action.payload;
    },

    setLoadingInvitations: (state, action: PayloadAction<boolean>) => {
      state.isLoadingInvitations = action.payload;
    },

    setLoadingSSO: (state, action: PayloadAction<boolean>) => {
      state.isLoadingSSO = action.payload;
    },

    setInviting: (state, action: PayloadAction<boolean>) => {
      state.isInviting = action.payload;
    },

    // Error handling
    setTeamError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoadingTeams = false;
      state.isLoadingMembers = false;
      state.isLoadingInvitations = false;
      state.isInviting = false;
    },

    // Clear team state (on logout or team switch)
    clearTeamState: (state) => {
      state.currentTeamId = null;
      state.currentTeam = null;
      state.members = [];
      state.invitations = [];
      state.accessControls = [];
      state.assetShareList = [];
      state.ssoInfo = null;
    },
  },
});

export const {
  setTeams,
  addTeam,
  updateTeam,
  deleteTeam,
  setCurrentTeam,
  setMembers,
  addMember,
  updateMember,
  removeMember,
  updateMemberRole,
  setInvitations,
  addInvitation,
  updateInvitation,
  revokeInvitation,
  deleteInvitation,
  setAccessControls,
  addAccessControl,
  removeAccessControl,
  setAssetShareList,
  setSSOInfo,
  setRenewalSettings,
  setScimUnmanagedAccounts,
  setLoadingTeams,
  setLoadingMembers,
  setLoadingInvitations,
  setLoadingSSO,
  setInviting,
  setTeamError,
  clearTeamState,
} = teamSlice.actions;

export default teamSlice.reducer;
