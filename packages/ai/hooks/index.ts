/**
 * @repo/ai - Advanced Hooks
 *
 * High-performance React hooks for AI integration.
 */

// Core chat hooks
export { useChatStream, type UseChatStreamOptions, type UseChatStreamReturn, type ChatStatus } from './use-chat-stream';
export {
  useRealTimeChat,
  type UseRealTimeChatOptions,
  type UseRealTimeChatReturn,
  type SendMessageOptions,
  type CreateMessage,
  type ToolCallInfo,
} from './use-realtime-chat';

// Input hooks
export { useVoiceInput, type UseVoiceInputReturn, type VoiceInputOptions, type VoiceInputState } from './use-voice-input';
export { useFileUpload, type UseFileUploadReturn, type UseFileUploadOptions } from './use-file-upload';

// Redux integration hooks
export {
  useReduxChat,
  type UseReduxChatOptions,
  type UseReduxChatReturn,
} from './use-redux-chat';
