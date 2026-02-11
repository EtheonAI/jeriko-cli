import { describe, it, expect } from "vitest";
import devicesReducer, {
  addApprovalRequest,
  approveDevice,
  rejectDevice,
  removeApprovalRequest,
  clearApprovalRequests,
  type DevicesState,
  type DeviceApprovalRequest,
} from "../devices.slice";

describe("devices.slice - P6.12 approval flow", () => {
  const initialState: DevicesState = {
    devices: [],
    selectedDeviceId: null,
    approvalRequests: [],
    isLoading: false,
    error: null,
  };

  const mockApprovalRequest: DeviceApprovalRequest = {
    id: "approval-1",
    deviceId: "device-1",
    userId: "user-1",
    deviceName: "Test Device",
    deviceType: "browser",
    requestedAt: new Date().toISOString(),
    status: "pending",
  };

  describe("addApprovalRequest", () => {
    it("should add an approval request", () => {
      const state = devicesReducer(initialState, addApprovalRequest(mockApprovalRequest));
      expect(state.approvalRequests).toHaveLength(1);
      expect(state.approvalRequests[0]).toEqual(mockApprovalRequest);
    });

    it("should add multiple approval requests", () => {
      const request2: DeviceApprovalRequest = {
        ...mockApprovalRequest,
        id: "approval-2",
        deviceId: "device-2",
      };

      let state = devicesReducer(initialState, addApprovalRequest(mockApprovalRequest));
      state = devicesReducer(state, addApprovalRequest(request2));

      expect(state.approvalRequests).toHaveLength(2);
    });
  });

  describe("approveDevice", () => {
    it("should approve a pending request", () => {
      const stateWithRequest = devicesReducer(
        initialState,
        addApprovalRequest(mockApprovalRequest)
      );

      const state = devicesReducer(stateWithRequest, approveDevice("approval-1"));

      const request = state.approvalRequests.find((r) => r.id === "approval-1");
      expect(request?.status).toBe("approved");
    });

    it("should not affect other requests", () => {
      const request2: DeviceApprovalRequest = {
        ...mockApprovalRequest,
        id: "approval-2",
        deviceId: "device-2",
      };

      let state = devicesReducer(initialState, addApprovalRequest(mockApprovalRequest));
      state = devicesReducer(state, addApprovalRequest(request2));
      state = devicesReducer(state, approveDevice("approval-1"));

      expect(state.approvalRequests[0]?.status).toBe("approved");
      expect(state.approvalRequests[1]?.status).toBe("pending");
    });

    it("should handle approving non-existent request gracefully", () => {
      const state = devicesReducer(initialState, approveDevice("nonexistent"));
      expect(state.approvalRequests).toHaveLength(0);
    });
  });

  describe("rejectDevice", () => {
    it("should reject a pending request", () => {
      const stateWithRequest = devicesReducer(
        initialState,
        addApprovalRequest(mockApprovalRequest)
      );

      const state = devicesReducer(stateWithRequest, rejectDevice("approval-1"));

      const request = state.approvalRequests.find((r) => r.id === "approval-1");
      expect(request?.status).toBe("rejected");
    });

    it("should not affect other requests", () => {
      const request2: DeviceApprovalRequest = {
        ...mockApprovalRequest,
        id: "approval-2",
        deviceId: "device-2",
      };

      let state = devicesReducer(initialState, addApprovalRequest(mockApprovalRequest));
      state = devicesReducer(state, addApprovalRequest(request2));
      state = devicesReducer(state, rejectDevice("approval-1"));

      expect(state.approvalRequests[0]?.status).toBe("rejected");
      expect(state.approvalRequests[1]?.status).toBe("pending");
    });
  });

  describe("removeApprovalRequest", () => {
    it("should remove an approval request", () => {
      const stateWithRequest = devicesReducer(
        initialState,
        addApprovalRequest(mockApprovalRequest)
      );

      const state = devicesReducer(stateWithRequest, removeApprovalRequest("approval-1"));

      expect(state.approvalRequests).toHaveLength(0);
    });

    it("should remove only the specified request", () => {
      const request2: DeviceApprovalRequest = {
        ...mockApprovalRequest,
        id: "approval-2",
        deviceId: "device-2",
      };

      let state = devicesReducer(initialState, addApprovalRequest(mockApprovalRequest));
      state = devicesReducer(state, addApprovalRequest(request2));
      state = devicesReducer(state, removeApprovalRequest("approval-1"));

      expect(state.approvalRequests).toHaveLength(1);
      expect(state.approvalRequests[0]?.id).toBe("approval-2");
    });
  });

  describe("clearApprovalRequests", () => {
    it("should clear all approval requests", () => {
      const request2: DeviceApprovalRequest = {
        ...mockApprovalRequest,
        id: "approval-2",
        deviceId: "device-2",
      };

      let state = devicesReducer(initialState, addApprovalRequest(mockApprovalRequest));
      state = devicesReducer(state, addApprovalRequest(request2));
      state = devicesReducer(state, clearApprovalRequests());

      expect(state.approvalRequests).toHaveLength(0);
    });

    it("should work when there are no requests", () => {
      const state = devicesReducer(initialState, clearApprovalRequests());
      expect(state.approvalRequests).toHaveLength(0);
    });
  });
});
