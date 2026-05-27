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
const isActiveWorkspaceFile = (file) =>
  !file.startsWith("legacy/") &&
  !file.includes("/legacy/") &&
  !file.startsWith(".pnpm-store/") &&
  !file.includes("e2b-templates/");
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
