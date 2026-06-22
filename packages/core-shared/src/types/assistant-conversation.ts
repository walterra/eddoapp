/** Assistant conversation types for cross-channel user chat. */

export type AssistantConversationChannel = 'telegram' | 'web';
export type AssistantConversationRole = 'user' | 'assistant';

/** Telegram metadata for a persisted assistant message. */
export interface AssistantTelegramMetadata {
  chatId: number;
  userId: number;
  messageId?: number;
}

/** Channel-specific metadata for assistant messages. */
export interface AssistantMessageChannelMetadata {
  telegram?: AssistantTelegramMetadata;
}

/** Assistant conversation statistics. */
export interface AssistantConversationStats {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
}

/** Assistant conversation metadata for one user. */
export interface AssistantConversation {
  _id: string;
  _rev?: string;
  version: 'assistant_conversation_alpha1';
  username: string;
  active: boolean;
  title?: string;
  createdAt: string;
  updatedAt: string;
  stats: AssistantConversationStats;
}

/** Tracks the currently active assistant conversation. */
export interface AssistantConversationState {
  _id: 'assistant_conversation_state';
  _rev?: string;
  version: 'assistant_conversation_state_alpha1';
  activeConversationId: string;
  updatedAt: string;
}

/** Message stored in an assistant conversation. */
export interface AssistantConversationMessageDoc {
  _id: string;
  _rev?: string;
  version: 'assistant_conversation_message_alpha1';
  conversationId: string;
  role: AssistantConversationRole;
  content: string;
  channel: AssistantConversationChannel;
  channelMetadata?: AssistantMessageChannelMetadata;
  createdAt: string;
  sequence: number;
}

/** Request for appending an assistant conversation message. */
export interface AppendAssistantConversationMessageRequest {
  role: AssistantConversationRole;
  content: string;
  channel: AssistantConversationChannel;
  channelMetadata?: AssistantMessageChannelMetadata;
}

/** Assistant conversation operations. */
export interface AssistantConversationOperations {
  ensureDatabase(): Promise<void>;
  setupDesignDocuments(): Promise<void>;
  getOrCreateActive(): Promise<AssistantConversation>;
  startNewConversation(): Promise<AssistantConversation>;
  getMessages(conversationId: string): Promise<AssistantConversationMessageDoc[]>;
  appendMessage(
    conversationId: string,
    request: AppendAssistantConversationMessageRequest,
  ): Promise<AssistantConversationMessageDoc>;
}

/** Creates empty assistant conversation statistics. */
export function createDefaultAssistantConversationStats(): AssistantConversationStats {
  return {
    messageCount: 0,
    userMessageCount: 0,
    assistantMessageCount: 0,
  };
}
