import type {
  AssistantConversation,
  AssistantConversationMessageDoc,
} from './assistant-conversation';

/** Returns the latest history page and a durable live-update checkpoint. */
export interface AssistantHistoryPage {
  conversation: AssistantConversation | null;
  messages: AssistantConversationMessageDoc[];
  nextCursor: string | null;
  changeCursor: string;
}

/** Invalidates projected history without exposing unrelated chat documents. */
export interface AssistantHistoryChange {
  kind: 'message' | 'conversation';
  documentId: string;
}

/** Identifies one logical browser submission across ambiguous transport failures. */
export interface AssistantMessageSubmission {
  requestId: string;
  text: string;
}
