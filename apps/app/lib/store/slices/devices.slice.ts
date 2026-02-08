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

export interface DevicesState {
  devices: DeviceItem[];
  selectedDeviceId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: DevicesState = {
  devices: [],
  selectedDeviceId: null,
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
} = devicesSlice.actions;

export default devicesSlice.reducer;
