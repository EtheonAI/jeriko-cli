/**
 * Build the Rubic Desktop E2B template.
 *
 * Run: npx tsx build.ts
 *
 * This creates a custom E2B sandbox template with Ubuntu Desktop + Neko WebRTC.
 * The template ID "rubic-desktop" is used by the agent service when
 * creating new sandboxes via the E2B SDK.
 *
 * Requirements:
 *   - E2B_API_KEY environment variable
 *   - e2b package installed
 */

import { Template, defaultBuildLogger } from "e2b";
import { template as desktopTemplate } from "./template";

console.log("Building Rubic Desktop template...");
console.log("This may take 10-15 minutes for the first build.");
console.log("Includes: XFCE Desktop + Neko WebRTC + Playwright + GStreamer");

await Template.build(desktopTemplate, "rubic-desktop", {
  cpuCount: 4,
  memoryMB: 4096,
  onBuildLogs: defaultBuildLogger(),
});

console.log("Template 'rubic-desktop' built successfully!");
console.log("Use: DesktopSandbox({ template: 'rubic-desktop' })");
