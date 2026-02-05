"use client";

import { useCallback, useRef, useState } from "react";
import { useFileUpload } from "@repo/ai/hooks";
import type { SkillId } from "./types";

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export interface UsePromptStateOptions {
  initialValue?: string;
  initialModel?: string;
}

export function usePromptState(options: UsePromptStateOptions = {}) {
  const { initialValue = "", initialModel = DEFAULT_MODEL } = options;

  // Text state
  const [text, setText] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Model state
  const [selectedModel, setSelectedModel] = useState(initialModel);

  // Skills state
  const [activeSkills, setActiveSkills] = useState<SkillId[]>([]);

  // File upload
  const { attachments, addFiles, removeFile, clearFiles, isUploading } = useFileUpload({
    maxSize: 50 * 1024 * 1024,
    maxFiles: 10,
  });

  // Skill toggling
  const toggleSkill = useCallback((skillId: SkillId) => {
    setActiveSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  }, []);

  // Auto-resize textarea
  const handleTextareaResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Reset state after submit
  const reset = useCallback(() => {
    setText("");
    clearFiles();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [clearFiles]);

  return {
    // Text
    text,
    setText,
    textareaRef,
    fileInputRef,
    handleTextareaResize,

    // Model
    selectedModel,
    setSelectedModel,

    // Skills
    activeSkills,
    setActiveSkills,
    toggleSkill,

    // Attachments
    attachments,
    addFiles,
    removeFile,
    clearFiles,
    isUploading,

    // Actions
    reset,
  };
}
