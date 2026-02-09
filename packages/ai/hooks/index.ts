/**
 * @repo/ai - Advanced Hooks
 *
 * High-performance React hooks for AI integration.
 */

// Core chat hooks
export { useChatStream, type UseChatStreamOptions, type UseChatStreamReturn, type ChatStatus } from './use-chat-stream';

// Input hooks
export { useVoiceInput, type UseVoiceInputReturn, type VoiceInputOptions, type VoiceInputState } from './use-voice-input';
export { useFileUpload, type UseFileUploadReturn, type UseFileUploadOptions } from './use-file-upload';

// E2B live streaming hooks
export { useE2BStream, type UseE2BStreamOptions, type UseE2BStreamReturn } from './use-e2b-stream';
export { useE2BTerminal, type UseE2BTerminalOptions, type UseE2BTerminalReturn } from './use-e2b-terminal';
