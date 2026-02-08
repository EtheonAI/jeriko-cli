"use client";

import * as React from "react";
import {
  FileIcon as GenericFile,
  FileTextIcon,
  FileCodeIcon,
  FileJsonIcon,
  ImageIcon,
  FileTypeIcon,
  FolderIcon,
  FolderOpenIcon,
  SettingsIcon,
  DatabaseIcon,
  GlobeIcon,
  TerminalIcon,
  LockIcon,
  PackageIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";

// ============================================================================
// Extension → Icon + Color Mapping
// ============================================================================

interface IconConfig {
  icon: React.ElementType;
  color: string;
}

const EXT_MAP: Record<string, IconConfig> = {
  // TypeScript / JavaScript
  ts: { icon: FileCodeIcon, color: "text-blue-400" },
  tsx: { icon: FileCodeIcon, color: "text-blue-400" },
  js: { icon: FileCodeIcon, color: "text-yellow-400" },
  jsx: { icon: FileCodeIcon, color: "text-yellow-400" },
  mjs: { icon: FileCodeIcon, color: "text-yellow-400" },
  cjs: { icon: FileCodeIcon, color: "text-yellow-400" },

  // Python
  py: { icon: FileCodeIcon, color: "text-yellow-300" },
  pyi: { icon: FileCodeIcon, color: "text-yellow-300" },

  // Go
  go: { icon: FileCodeIcon, color: "text-cyan-400" },

  // Rust
  rs: { icon: FileCodeIcon, color: "text-orange-400" },
  toml: { icon: SettingsIcon, color: "text-orange-300" },

  // Java / Kotlin
  java: { icon: FileCodeIcon, color: "text-red-400" },
  kt: { icon: FileCodeIcon, color: "text-purple-400" },

  // C / C++
  c: { icon: FileCodeIcon, color: "text-blue-300" },
  h: { icon: FileCodeIcon, color: "text-blue-300" },
  cpp: { icon: FileCodeIcon, color: "text-blue-500" },
  hpp: { icon: FileCodeIcon, color: "text-blue-500" },

  // Ruby
  rb: { icon: FileCodeIcon, color: "text-red-500" },

  // PHP
  php: { icon: FileCodeIcon, color: "text-indigo-400" },

  // Swift
  swift: { icon: FileCodeIcon, color: "text-orange-500" },

  // Web
  html: { icon: GlobeIcon, color: "text-orange-400" },
  css: { icon: FileTypeIcon, color: "text-blue-400" },
  scss: { icon: FileTypeIcon, color: "text-pink-400" },
  less: { icon: FileTypeIcon, color: "text-blue-300" },
  svg: { icon: ImageIcon, color: "text-yellow-400" },

  // Data
  json: { icon: FileJsonIcon, color: "text-yellow-300" },
  yaml: { icon: FileTextIcon, color: "text-red-300" },
  yml: { icon: FileTextIcon, color: "text-red-300" },
  xml: { icon: FileTextIcon, color: "text-orange-300" },
  csv: { icon: DatabaseIcon, color: "text-green-400" },

  // Config
  env: { icon: LockIcon, color: "text-yellow-500" },
  gitignore: { icon: SettingsIcon, color: "text-gray-400" },
  dockerignore: { icon: SettingsIcon, color: "text-gray-400" },
  editorconfig: { icon: SettingsIcon, color: "text-gray-400" },
  prettierrc: { icon: SettingsIcon, color: "text-gray-400" },
  eslintrc: { icon: SettingsIcon, color: "text-purple-300" },

  // Shell
  sh: { icon: TerminalIcon, color: "text-green-400" },
  bash: { icon: TerminalIcon, color: "text-green-400" },
  zsh: { icon: TerminalIcon, color: "text-green-400" },
  fish: { icon: TerminalIcon, color: "text-green-400" },

  // Docs
  md: { icon: FileTextIcon, color: "text-blue-300" },
  mdx: { icon: FileTextIcon, color: "text-blue-300" },
  txt: { icon: FileTextIcon, color: "text-gray-400" },
  rst: { icon: FileTextIcon, color: "text-gray-400" },

  // SQL
  sql: { icon: DatabaseIcon, color: "text-blue-400" },

  // Images
  png: { icon: ImageIcon, color: "text-green-400" },
  jpg: { icon: ImageIcon, color: "text-green-400" },
  jpeg: { icon: ImageIcon, color: "text-green-400" },
  gif: { icon: ImageIcon, color: "text-green-400" },
  webp: { icon: ImageIcon, color: "text-green-400" },
  ico: { icon: ImageIcon, color: "text-green-400" },

  // Package
  lock: { icon: LockIcon, color: "text-gray-400" },
};

// Named files (no extension or full name match)
const NAME_MAP: Record<string, IconConfig> = {
  Dockerfile: { icon: PackageIcon, color: "text-blue-400" },
  "docker-compose.yml": { icon: PackageIcon, color: "text-blue-400" },
  "docker-compose.yaml": { icon: PackageIcon, color: "text-blue-400" },
  Makefile: { icon: TerminalIcon, color: "text-orange-300" },
  LICENSE: { icon: FileTextIcon, color: "text-yellow-400" },
  README: { icon: FileTextIcon, color: "text-blue-300" },
  "README.md": { icon: FileTextIcon, color: "text-blue-300" },
  "package.json": { icon: PackageIcon, color: "text-green-400" },
  "tsconfig.json": { icon: SettingsIcon, color: "text-blue-400" },
  ".gitignore": { icon: SettingsIcon, color: "text-gray-400" },
  ".env": { icon: LockIcon, color: "text-yellow-500" },
  ".env.local": { icon: LockIcon, color: "text-yellow-500" },
  ".env.example": { icon: LockIcon, color: "text-yellow-500" },
};

// ============================================================================
// Component
// ============================================================================

interface FileIconProps {
  name: string;
  isDirectory?: boolean;
  isOpen?: boolean;
  className?: string;
}

export function LanguageFileIcon({ name, isDirectory, isOpen, className }: FileIconProps) {
  if (isDirectory) {
    const Icon = isOpen ? FolderOpenIcon : FolderIcon;
    return <Icon className={cn("text-blue-400", className)} />;
  }

  // Check exact name match first
  const nameConfig = NAME_MAP[name];
  if (nameConfig) {
    const Icon = nameConfig.icon;
    return <Icon className={cn(nameConfig.color, className)} />;
  }

  // Check extension
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const extConfig = EXT_MAP[ext];
  if (extConfig) {
    const Icon = extConfig.icon;
    return <Icon className={cn(extConfig.color, className)} />;
  }

  // Fallback
  return <GenericFile className={cn("text-muted-foreground/50", className)} />;
}
