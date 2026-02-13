/**
 * Build the Rubic Desktop E2B template.
 *
 * Run: npx e2b template build
 *
 * Uses e2b.toml + Dockerfile for template definition.
 * The template ID is defined in e2b.toml.
 *
 * Requirements:
 *   - E2B_API_KEY environment variable
 *   - e2b CLI installed (npx e2b)
 */

import { execSync } from "child_process";

console.log("Building Rubic Desktop template...");
console.log("This may take 10-15 minutes for the first build.");
console.log("Includes: XFCE Desktop + Neko WebRTC + Python Sandbox Runtime + Go binaries");

try {
  execSync("npx e2b template build", {
    cwd: import.meta.dirname,
    stdio: "inherit",
  });
  console.log("Template built successfully!");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
