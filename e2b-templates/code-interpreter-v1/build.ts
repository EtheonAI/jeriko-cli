/**
 * Build the Rubic Code Interpreter E2B template.
 *
 * Run: npx tsx build.ts
 *
 * This creates an E2B sandbox template with Python + Jupyter + Data Science libs.
 * The template ID "code-interpreter-v1" is used by the agent service when
 * the user requests code execution via the code_execute tool.
 *
 * Requirements:
 *   - E2B_API_KEY environment variable
 *   - e2b package installed
 */

import { Template, defaultBuildLogger } from "e2b";
import { template as codeInterpreterTemplate } from "./template";

console.log("Building Rubic Code Interpreter template...");
console.log("This may take 10-15 minutes for the first build.");
console.log("Includes: Python + Jupyter + NumPy + Pandas + Matplotlib + Scikit-learn");

await Template.build(codeInterpreterTemplate, "code-interpreter-v1", {
  cpuCount: 4,
  memoryMB: 2048,
  onBuildLogs: defaultBuildLogger(),
});

console.log("Template 'code-interpreter-v1' built successfully!");
console.log("Use: Sandbox.create({ template: 'code-interpreter-v1' })");
