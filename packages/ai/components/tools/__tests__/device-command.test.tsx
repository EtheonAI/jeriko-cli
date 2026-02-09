// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { DeviceCommandRenderer } from "../renderers/device-command";

describe("DeviceCommandRenderer", () => {
  it("shows loading state during input-available", () => {
    const { container } = render(
      <DeviceCommandRenderer
        toolName="device_abc_command"
        toolCallId="tc-1"
        state="input-available"
        input={{ command: "turn_on" }}
      />
    );
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByText(/Executing on device/)).toBeInTheDocument();
  });

  it("shows approval required UI", () => {
    render(
      <DeviceCommandRenderer
        toolName="device_abc_command"
        toolCallId="tc-1"
        state="output-available"
        input={{ command: "reboot" }}
        output={{
          status: "approval_required",
          message: "This command contains 'reboot'. Please confirm.",
          command: "reboot",
        }}
      />
    );
    expect(screen.getByText(/Device Approval Required/)).toBeInTheDocument();
    // "reboot" appears in both message and code block, so use getAllByText
    expect(screen.getAllByText(/reboot/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Please confirm/)).toBeInTheDocument();
  });

  it("shows error state", () => {
    render(
      <DeviceCommandRenderer
        toolName="device_abc_command"
        toolCallId="tc-1"
        state="output-available"
        input={{ command: "status" }}
        output={{ error: "Device unreachable" }}
      />
    );
    expect(screen.getByText(/Device unreachable/)).toBeInTheDocument();
  });

  it("shows success state with result", () => {
    render(
      <DeviceCommandRenderer
        toolName="device_abc_command"
        toolCallId="tc-1"
        state="output-available"
        input={{ command: "status" }}
        output={{ result: { state: "on", brightness: 80 } }}
      />
    );
    expect(screen.getByText(/Command executed on device/)).toBeInTheDocument();
    expect(screen.getByText(/brightness/)).toBeInTheDocument();
  });

  it("returns null for non-output states without output", () => {
    const { container } = render(
      <DeviceCommandRenderer
        toolName="device_abc_command"
        toolCallId="tc-1"
        state="output-available"
        input={{ command: "test" }}
      />
    );
    // No output → null
    expect(container.innerHTML).toBe("");
  });
});
