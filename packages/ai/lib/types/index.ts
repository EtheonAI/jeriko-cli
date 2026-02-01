/**
 * @repo/ai - Type Definitions
 *
 * Comprehensive type system for the Rubic AI platform.
 */

// Export all core types
export * from './core';

// Re-export legacy types for backwards compatibility
// These are from the original index.d.ts
export type { ChatMessage, ChatTools, CustomUIDataTypes, MessageMetadata, DataPart } from './index.d';
