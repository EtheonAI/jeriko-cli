// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { renderHook } from "@testing-library/react";
import { ToolRegistry, useToolRegistry } from "../tool-registry";
import { GenericTool } from "../renderers/generic-tool";

describe("Tool Registry — dynamic device tools (P3.18)", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToolRegistry>{children}</ToolRegistry>
  );

  it("resolves device_* tools to DeviceCommandRenderer (not GenericTool)", () => {
    const { result } = renderHook(() => useToolRegistry(), { wrapper });

    const renderer = result.current.getRenderer("device_abc123_command");
    const fallback = result.current.getRenderer("*");
    expect(renderer).not.toBe(fallback);
    expect(renderer).not.toBe(GenericTool);
  });

  it("resolves different device IDs consistently", () => {
    const { result } = renderHook(() => useToolRegistry(), { wrapper });

    const r1 = result.current.getRenderer("device_living_room_light_command");
    const r2 = result.current.getRenderer("device_thermostat_command");
    // Both should resolve to the same renderer (DeviceCommandRenderer)
    expect(r1).toBe(r2);
    // Neither should be the generic fallback
    expect(r1).not.toBe(GenericTool);
  });

  it("does NOT use DeviceCommandRenderer for non-device tools", () => {
    const { result } = renderHook(() => useToolRegistry(), { wrapper });

    const shellRenderer = result.current.getRenderer("shell_exec");
    const deviceRenderer = result.current.getRenderer("device_abc_command");
    expect(shellRenderer).not.toBe(deviceRenderer);
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
