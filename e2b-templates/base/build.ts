/**
 * Build the Rubic Base E2B template.
 *
 * Run: npx tsx build.ts
 *
 * This creates a lightweight E2B sandbox template with Python + Node.js.
 * The template ID "base" is used by the agent service for non-browser,
 * non-code-execution tools (file ops, shell, web search fallback).
 *
 * Requirements:
 *   - E2B_API_KEY environment variable
 *   - e2b package installed
 */

import { Template, defaultBuildLogger } from "e2b";
import { template as baseTemplate } from "./template";

console.log("Building Rubic Base template...");
console.log("This may take 5-10 minutes for the first build.");
console.log("Includes: Ubuntu + Python + Node.js + basic tools");

await Template.build(baseTemplate, "base", {
  cpuCount: 2,
  memoryMB: 512,
  onBuildLogs: defaultBuildLogger(),
});

console.log("Template 'base' built successfully!");
console.log("Use: Sandbox.create({ template: 'base' })");
