import type {
  AssistantConversation,
  AssistantConversationMessageDoc,
  AssistantHistoryPage,
  AssistantProjectionIds,
  AssistantRequestStatus,
} from '@eddo/core-shared';

export type AssistantErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_request'
  | 'request_conflict'
  | 'rate_limited'
  | 'unavailable'
  | 'network'
  | 'protocol'
  | 'storage'
  | 'unsupported';
export class AssistantClientError extends Error {
  readonly name = 'AssistantClientError';
  constructor(
    readonly code: AssistantErrorCode,
    readonly retryAfter = 0,
  ) {
    super(code);
  }
}
export interface AssistantPendingRequest {
  username: string;
  submissionId: string;
  text: string;
  createdAt: string;
  conversationId: string | null;
  projectionIds: AssistantProjectionIds;
  receipt?: AssistantRequestStatus;
}
export type AssistantConnection = 'connecting' | 'connected' | 'reconnecting' | 'blocked';
export interface AssistantSnapshot {
  conversation: AssistantConversation | null;
  messages: readonly AssistantConversationMessageDoc[];
  nextCursor: string | null;
  loading: boolean;
  loadingOlder: boolean;
  submitting: boolean;
  connection: AssistantConnection;
  pending: AssistantPendingRequest | null;
  sharedRequests?: AssistantRequestStatus[];
  sharedHasMore?: boolean;
  error: AssistantErrorCode | null;
}
export interface AssistantServerEvent {
  event: string;
  data: unknown;
  id?: string;
}
export interface AssistantStreamRequest {
  cursor?: string;
  requestIds: string[];
  signal: AbortSignal;
  onEvent: (event: AssistantServerEvent) => void;
  onConnected: () => void;
}
export interface AssistantBrowserClient {
  history: (cursor?: string, signal?: AbortSignal) => Promise<AssistantHistoryPage>;
  admit: (pending: AssistantPendingRequest) => Promise<AssistantRequestStatus>;
  status: (requestId: string, signal?: AbortSignal) => Promise<AssistantRequestStatus | null>;
  stream: (request: AssistantStreamRequest) => Promise<void>;
}
export interface AssistantPendingStore {
  read: () => AssistantPendingRequest | null;
  write: (pending: AssistantPendingRequest) => void;
  clear: (submissionId: string) => void;
}
export interface AssistantSessionOptions {
  username: string;
  client: AssistantBrowserClient;
  pendingStore: AssistantPendingStore;
  uuid?: () => string;
  projectionIds?: (requestId: string) => Promise<AssistantProjectionIds>;
}
export interface AssistantSession {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => AssistantSnapshot;
  start: () => void;
  stop: () => void;
  send: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  refresh: () => Promise<void>;
  loadOlder: () => Promise<void>;
  dismiss: () => void;
}
