import type { AssistantHistoryPage, AssistantRequestStatus } from '@eddo/core-shared';
import { mergeAssistantHistory } from './assistant_history';
import {
  AssistantClientError,
  type AssistantPendingRequest,
  type AssistantPendingStore,
  type AssistantSnapshot,
} from './assistant_types';

export interface AssistantStateOptions {
  username: string;
  pendingStore: AssistantPendingStore;
  trackingChanged: () => void;
}
interface StateContext {
  options: AssistantStateOptions;
  value: AssistantSnapshot;
  listeners: Set<() => void>;
}
export interface AssistantStateCore {
  get: () => AssistantSnapshot;
  update: (patch: Partial<AssistantSnapshot>) => void;
  subscribe: (listener: () => void) => () => void;
  report: (error: unknown) => void;
  restore: () => void;
  save: (pending: AssistantPendingRequest) => void;
  accept: (receipt: AssistantRequestStatus) => void;
  history: (page: AssistantHistoryPage, older: boolean) => void;
  pendingId: () => string | undefined;
  dismiss: () => void;
}
export function isTerminalAssistantRequest(status?: AssistantRequestStatus['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'aborted';
}
function update(context: StateContext, patch: Partial<AssistantSnapshot>): void {
  context.value = { ...context.value, ...patch };
  for (const listener of context.listeners) listener();
}
function report(context: StateContext, error: unknown): void {
  update(context, { error: error instanceof AssistantClientError ? error.code : 'network' });
}
function save(context: StateContext, pending: AssistantPendingRequest): void {
  context.options.pendingStore.write(pending);
  update(context, { pending });
}
function restore(context: StateContext): void {
  try {
    update(context, { pending: context.options.pendingStore.read(), error: null });
  } catch (error) {
    report(context, error);
  }
}
const statusOrder: Record<AssistantRequestStatus['status'], number> = {
  queued: 0,
  working: 1,
  delivering: 2,
  projecting: 3,
  completed: 4,
  failed: 4,
  aborted: 4,
};
function latestReceipt(
  previous: AssistantRequestStatus | undefined,
  next: AssistantRequestStatus,
): AssistantRequestStatus {
  if (!previous) return next;
  if (
    isTerminalAssistantRequest(previous.status) ||
    statusOrder[previous.status] > statusOrder[next.status]
  )
    return previous;
  return next;
}
function accept(context: StateContext, receipt: AssistantRequestStatus): void {
  const pending = context.value.pending;
  if (!pending || receipt.requestId !== `web:${context.options.username}:${pending.submissionId}`)
    return;
  const stored = context.options.pendingStore.read();
  if (!stored || stored.submissionId !== pending.submissionId) return;
  const current = latestReceipt(stored.receipt, receipt);
  if (
    pending.receipt?.status !== current.status ||
    pending.conversationId !== current.conversationId
  )
    save(context, { ...pending, receipt: current, conversationId: current.conversationId });
}
function clear(context: StateContext): void {
  const pending = context.value.pending;
  if (!pending) return;
  context.options.pendingStore.clear(pending.submissionId);
  update(context, { pending: null, error: null });
  context.options.trackingChanged();
}
function history(context: StateContext, page: AssistantHistoryPage, older: boolean): void {
  update(context, mergeAssistantHistory(context.value, page, older));
  const pending = context.value.pending;
  if (
    pending?.receipt?.status === 'completed' &&
    context.value.messages.some((message) => message._id === pending.projectionIds.assistant)
  ) {
    try {
      clear(context);
    } catch (error) {
      report(context, error);
    }
  }
}

/** Stores account-scoped presentation state; no model generation or tool execution occurs here. */
export function createAssistantState(options: AssistantStateOptions): AssistantStateCore {
  const context: StateContext = {
    options,
    listeners: new Set(),
    value: {
      conversation: null,
      messages: [],
      nextCursor: null,
      loading: true,
      loadingOlder: false,
      submitting: false,
      connection: 'connecting',
      pending: null,
      error: null,
    },
  };
  return {
    get: () => context.value,
    update: (patch) => update(context, patch),
    subscribe: (listener) => {
      context.listeners.add(listener);
      return () => {
        context.listeners.delete(listener);
      };
    },
    report: (error) => report(context, error),
    restore: () => restore(context),
    save: (pending) => save(context, pending),
    accept: (receipt) => accept(context, receipt),
    history: (page, older) => history(context, page, older),
    pendingId: () =>
      context.value.pending
        ? `web:${options.username}:${context.value.pending.submissionId}`
        : undefined,
    dismiss: () => {
      if (!isTerminalAssistantRequest(context.value.pending?.receipt?.status)) return;
      try {
        clear(context);
      } catch (error) {
        report(context, error);
      }
    },
  };
}
