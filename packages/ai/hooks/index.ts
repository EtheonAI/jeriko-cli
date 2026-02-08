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
