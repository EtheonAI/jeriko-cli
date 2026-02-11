import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface DeviceItem {
  id: string;
  userId: string;
  name: string;
  type: "browser" | "desktop" | "mobile" | "server";
  status: "online" | "offline" | "busy" | "error";
  capabilities: string[];
  lastHeartbeat: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceApprovalRequest {
  id: string;
  deviceId: string;
  userId: string;
  deviceName: string;
  deviceType: DeviceItem["type"];
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface DevicesState {
  devices: DeviceItem[];
  selectedDeviceId: string | null;
  approvalRequests: DeviceApprovalRequest[];
  isLoading: boolean;
  error: string | null;
}

const initialState: DevicesState = {
  devices: [],
  selectedDeviceId: null,
  approvalRequests: [],
  isLoading: false,
  error: null,
};

const devicesSlice = createSlice({
  name: "devices",
  initialState,
  reducers: {
    setDevices: (state, action: PayloadAction<DeviceItem[]>) => {
      state.devices = action.payload;
      state.isLoading = false;
    },
    addDevice: (state, action: PayloadAction<DeviceItem>) => {
      state.devices.unshift(action.payload);
    },
    updateDeviceStatus: (
      state,
      action: PayloadAction<{
        deviceId: string;
        status: DeviceItem["status"];
        lastHeartbeat?: string;
      }>
    ) => {
      const index = state.devices.findIndex((d) => d.id === action.payload.deviceId);
      if (index !== -1) {
        state.devices[index]!.status = action.payload.status;
        if (action.payload.lastHeartbeat) {
          state.devices[index]!.lastHeartbeat = action.payload.lastHeartbeat;
        }
      }
    },
    removeDevice: (state, action: PayloadAction<string>) => {
      state.devices = state.devices.filter((d) => d.id !== action.payload);
      if (state.selectedDeviceId === action.payload) {
        state.selectedDeviceId = null;
      }
    },
    setSelectedDevice: (state, action: PayloadAction<string | null>) => {
      state.selectedDeviceId = action.payload;
    },
    setDevicesLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setDevicesError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    // Device approval flow
    addApprovalRequest: (state, action: PayloadAction<DeviceApprovalRequest>) => {
      state.approvalRequests.push(action.payload);
    },
    approveDevice: (state, action: PayloadAction<string>) => {
      const request = state.approvalRequests.find((r) => r.id === action.payload);
      if (request) {
        request.status = "approved";
      }
    },
    rejectDevice: (state, action: PayloadAction<string>) => {
      const request = state.approvalRequests.find((r) => r.id === action.payload);
      if (request) {
        request.status = "rejected";
      }
    },
    removeApprovalRequest: (state, action: PayloadAction<string>) => {
      state.approvalRequests = state.approvalRequests.filter((r) => r.id !== action.payload);
    },
    clearApprovalRequests: (state) => {
      state.approvalRequests = [];
    },
  },
});

export const {
  setDevices,
  addDevice,
  updateDeviceStatus,
  removeDevice,
  setSelectedDevice,
  setDevicesLoading,
  setDevicesError,
  addApprovalRequest,
  approveDevice,
  rejectDevice,
  removeApprovalRequest,
  clearApprovalRequests,
} = devicesSlice.actions;

export default devicesSlice.reducer;
