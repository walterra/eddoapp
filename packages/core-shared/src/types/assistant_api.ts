import type {
  AssistantConversation,
  AssistantConversationMessageDoc,
} from './assistant-conversation';
import type { AssistantRequestStatus } from './assistant_request';

/** Returns the latest history page and a durable live-update checkpoint. */
export interface AssistantHistoryPage {
  conversation: AssistantConversation | null;
  messages: AssistantConversationMessageDoc[];
  nextCursor: string | null;
  changeCursor: string;
}

/** Lists bounded account-owned work across channels without exposing prompts or tool arguments. */
export interface AssistantPendingRequests {
  requests: AssistantRequestStatus[];
  hasMore: boolean;
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
