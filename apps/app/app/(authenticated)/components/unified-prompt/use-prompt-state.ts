"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { useFileUpload } from "@repo/ai/hooks";
import type { SkillId } from "./types";
import type { SelectedConnection } from "./connections-modal";

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

  // Focus state (for animated placeholder)
  const [isFocused, setIsFocused] = useState(false);

  // Model state
  const [selectedModel, setSelectedModel] = useState(initialModel);

  // Skills state
  const [activeSkills, setActiveSkills] = useState<SkillId[]>([]);

  // Connections state
  const [selectedConnections, setSelectedConnections] = useState<SelectedConnection[]>([]);

  // Drag-drop state
  const [isDragging, setIsDragging] = useState(false);

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

  // Connection toggling
  const toggleConnection = useCallback((connection: SelectedConnection) => {
    setSelectedConnections((prev) => {
      const exists = prev.some((c) => c.id === connection.id);
      return exists ? prev.filter((c) => c.id !== connection.id) : [...prev, connection];
    });
  }, []);

  // Auto-resize textarea
  const handleTextareaResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Focus handlers
  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  // Drag-drop handlers
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        addFiles(files);
      }
    },
    [addFiles]
  );

  // Paste handler for images
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        const dt = new DataTransfer();
        for (const f of imageFiles) dt.items.add(f);
        addFiles(dt.files);
      }
    },
    [addFiles]
  );

  // Reset state after submit
  const reset = useCallback(() => {
    setText("");
    clearFiles();
    setActiveSkills([]);
    setSelectedConnections([]);
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

    // Focus
    isFocused,
    handleFocus,
    handleBlur,

    // Model
    selectedModel,
    setSelectedModel,

    // Skills
    activeSkills,
    setActiveSkills,
    toggleSkill,

    // Connections
    selectedConnections,
    toggleConnection,

    // Attachments
    attachments,
    addFiles,
    removeFile,
    clearFiles,
    isUploading,

    // Drag-drop
    isDragging,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,

    // Paste
    handlePaste,

    // Actions
    reset,
  };
}
