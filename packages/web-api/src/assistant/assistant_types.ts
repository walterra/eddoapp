import type {
  AssistantHistoryChange,
  AssistantHistoryPage,
  AssistantMessageSubmission,
  AssistantPendingRequests,
  AssistantRequestStatus,
} from '@eddo/core-shared';

export interface AssistantHistoryQuery {
  limit: number;
  cursor?: string;
}
export interface AssistantProjectionChange {
  sequence: string;
  change: AssistantHistoryChange;
}
export interface AssistantChangesBatch {
  changes: AssistantProjectionChange[];
  lastSequence: string;
}
export interface AssistantProjectionStore {
  history: (username: string, query: AssistantHistoryQuery) => Promise<AssistantHistoryPage>;
  watermark: (username: string) => Promise<string>;
  changes: (username: string, since: string, signal: AbortSignal) => Promise<AssistantChangesBatch>;
}
export interface AssistantHostClient {
  pending: (username: string, signal?: AbortSignal) => Promise<AssistantPendingRequests>;
  admit: (username: string, input: AssistantMessageSubmission) => Promise<AssistantRequestStatus>;
  status: (
    username: string,
    requestId: string,
    signal?: AbortSignal,
  ) => Promise<AssistantRequestStatus | null>;
}
export interface AssistantService {
  store: AssistantProjectionStore;
  host: AssistantHostClient;
  authorize: (username: string) => Promise<void>;
}
export interface AssistantIdentity {
  username: string;
  expiresAt: number;
}

/** Identifies invalidated CouchDB checkpoints that require a fresh history snapshot. */
export class AssistantCursorExpiredError extends Error {
  readonly name = 'AssistantCursorExpiredError';
}
