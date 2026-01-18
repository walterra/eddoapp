/**
 * Chat types for AI agent sessions.
 * Re-exports from split modules for backward compatibility.
 */

// Message types
export {
  isAssistantMessage,
  isToolResultMessage,
  isUserMessage,
  type AssistantMessage,
  type BashExecutionMessage,
  type ChatMessage,
  type ContentBlock,
  type CustomMessage,
  type ImageContent,
  type MessageAttachment,
  type MessageRole,
  type ModelProvider,
  type StopReason,
  type TextContent,
  type ThinkingContent,
  type ThinkingLevel,
  type TokenUsage,
  type ToolCallContent,
  type ToolResultMessage,
  type UserMessage,
} from './chat-messages';

// Session types
export {
  createDefaultSessionStats,
  isChatSession,
  isSessionMessageEntry,
  type BranchSummaryEntry,
  type ChatMessageDoc,
  type ChatSession,
  type ChatSessionOperations,
  type CompactionEntry,
  type ContainerState,
  type CreateChatSessionRequest,
  type CustomEntry,
  type CustomMessageEntry,
  type LabelEntry,
  type ModelChangeEntry,
  type SessionEntry,
  type SessionEntryBase,
  type SessionEntryType,
  type SessionHeaderEntry,
  type SessionInfoEntry,
  type SessionMessageEntry,
  type SessionRepository,
  type SessionStats,
  type SetupLogEntry,
  type ThinkingLevelChangeEntry,
  type UpdateChatSessionRequest,
  type WorktreeState,
} from './chat-session';
