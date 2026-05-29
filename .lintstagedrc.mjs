import { existsSync } from "node:fs";

const quote = (file) => JSON.stringify(file);
const chunk = (files, size = 40) => {
  const chunks = [];

  for (let index = 0; index < files.length; index += size) {
    chunks.push(files.slice(index, index + size));
  }

  return chunks;
};

const existingFiles = (files) => files.filter((file) => existsSync(file));
const commandsFor = (command, args, files) =>
  chunk(files).map((group) => `${command} ${args} ${group.map(quote).join(" ")}`);
const inactivePrefixes = ["legacy/", ".pnpm-store/", "docs/ai-workflow-os/_source/"];
const inactiveSegments = ["/legacy/", "e2b-templates/"];
const isActiveWorkspaceFile = (file) =>
  !inactivePrefixes.some((prefix) => file.startsWith(prefix)) &&
  !inactiveSegments.some((segment) => file.includes(segment));
const activeExistingFiles = (files) => existingFiles(files).filter(isActiveWorkspaceFile);

export default {
  "*.{ts,tsx,js,jsx,mjs,cjs}": (files) => {
    const filtered = activeExistingFiles(files);
    if (filtered.length === 0) return [];
    return [
      ...commandsFor("eslint", "--fix", filtered),
      ...commandsFor("prettier", "--write", filtered),
    ];
  },
  "*.{json,md,yml,yaml}": (files) => commandsFor("prettier", "--write", activeExistingFiles(files)),
  "*.go": (files) => commandsFor("gofmt", "-w", activeExistingFiles(files)),
};
