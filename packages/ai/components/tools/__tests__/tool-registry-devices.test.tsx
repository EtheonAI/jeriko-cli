// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { renderHook } from "@testing-library/react";
import { ToolRegistry, useToolRegistry } from "../tool-registry";
import { DeviceCommandRenderer } from "../renderers/device-command";
import { GenericTool } from "../renderers/generic-tool";

describe("Tool Registry — dynamic device tools (P3.18)", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToolRegistry>{children}</ToolRegistry>
  );

  it("resolves device_* tools to DeviceCommandRenderer", () => {
    const { result } = renderHook(() => useToolRegistry(), { wrapper });

    const renderer = result.current.getRenderer("device_abc123_command");
    expect(renderer).toBe(DeviceCommandRenderer);
  });

  it("resolves different device IDs to DeviceCommandRenderer", () => {
    const { result } = renderHook(() => useToolRegistry(), { wrapper });

    const r1 = result.current.getRenderer("device_living_room_light_command");
    const r2 = result.current.getRenderer("device_thermostat_command");
    expect(r1).toBe(DeviceCommandRenderer);
    expect(r2).toBe(DeviceCommandRenderer);
  });

  it("does NOT use DeviceCommandRenderer for non-device tools", () => {
    const { result } = renderHook(() => useToolRegistry(), { wrapper });

    const shellRenderer = result.current.getRenderer("shell_exec");
    expect(shellRenderer).not.toBe(DeviceCommandRenderer);
  });

  it("falls back to GenericTool for unknown non-device tools", () => {
    const { result } = renderHook(() => useToolRegistry(), { wrapper });

    const renderer = result.current.getRenderer("totally_unknown_tool");
    expect(renderer).toBe(GenericTool);
  });

  it("track_analytics is registered (not falling through to GenericTool)", () => {
    const { result } = renderHook(() => useToolRegistry(), { wrapper });

    const renderer = result.current.getRenderer("track_analytics");
    const fallback = result.current.getRenderer("*");
    expect(renderer).not.toBe(fallback);
  });
});
