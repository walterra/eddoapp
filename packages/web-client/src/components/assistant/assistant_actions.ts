import { assistantProjectionIds, type AssistantRequestStatus } from '@eddo/core-shared';
import type { AssistantLiveConnection } from './assistant_connection';
import type { AssistantHistoryController } from './assistant_history_controller';
import { isTerminalAssistantRequest, type AssistantStateCore } from './assistant_state';
import {
  AssistantClientError,
  type AssistantPendingRequest,
  type AssistantSession,
  type AssistantSessionOptions,
  type AssistantSnapshot,
} from './assistant_types';

export interface AssistantActionContext {
  options: AssistantSessionOptions;
  core: AssistantStateCore;
  live: AssistantLiveConnection;
  history: AssistantHistoryController;
}
interface ActionContext extends AssistantActionContext {
  revision: number;
}
async function submit(context: ActionContext, pending: AssistantPendingRequest): Promise<void> {
  if (context.core.get().pending?.cancelRequested) return;
  const revision = context.revision;
  context.core.update({ submitting: true, error: null });
  try {
    const receipt = await context.options.client.admit(pending);
    if (revision === context.revision) {
      context.core.accept(receipt);
      context.history.invalidate();
    }
  } catch (error) {
    if (revision === context.revision) context.core.report(error);
  } finally {
    if (revision === context.revision) context.core.update({ submitting: false });
  }
}
function requireBrowserIdentity(options: AssistantSessionOptions): void {
  if (!options.uuid && typeof globalThis.crypto?.randomUUID !== 'function')
    throw new AssistantClientError('unsupported');
  if (!options.projectionIds && !globalThis.crypto?.subtle)
    throw new AssistantClientError('unsupported');
}
async function pendingRequest(
  context: ActionContext,
  text: string,
): Promise<AssistantPendingRequest> {
  const state = context.core.get();
  requireBrowserIdentity(context.options);
  const content = text.trim();
  if (!content || content.length > 8000) throw new AssistantClientError('invalid_request');
  const submissionId = (context.options.uuid ?? (() => crypto.randomUUID()))();
  if (
    new TextEncoder().encode(JSON.stringify({ requestId: submissionId, text: content }))
      .byteLength > 32768
  )
    throw new AssistantClientError('invalid_request');
  return {
    username: context.options.username,
    submissionId,
    text: content,
    createdAt: new Date().toISOString(),
    conversationId: state.conversation?._id ?? null,
    projectionIds: await (context.options.projectionIds ?? assistantProjectionIds)(
      `web:${context.options.username}:${submissionId}`,
    ),
  };
}
async function send(context: ActionContext, text: string): Promise<void> {
  const state = context.core.get();
  if (
    state.pending ||
    state.submitting ||
    state.cancelling ||
    state.loading ||
    state.connection === 'blocked' ||
    state.error === 'storage'
  )
    return;
  const revision = context.revision;
  context.core.update({ submitting: true });
  try {
    const pending = await pendingRequest(context, text);
    context.core.save(pending);
    context.live.restart();
    await submit(context, pending);
  } catch (error) {
    if (revision === context.revision) {
      context.core.report(error);
      context.core.update({ submitting: false });
    }
  }
}
async function checkStatus(
  context: ActionContext,
  pending: AssistantPendingRequest,
  revision: number,
): Promise<void> {
  const receipt = await context.options.client.status(
    `web:${context.options.username}:${pending.submissionId}`,
  );
  if (revision !== context.revision || context.core.get().pending?.cancelRequested) return;
  if (receipt) {
    context.core.accept(receipt);
    context.history.invalidate();
  } else if (!pending.receipt) await submit(context, pending);
  else context.core.update({ error: 'unavailable' });
}
function retryBlocked(state: AssistantSnapshot): boolean {
  return Boolean(
    state.submitting ||
    state.cancelling ||
    isTerminalAssistantRequest(state.pending?.receipt?.status),
  );
}
async function retry(context: ActionContext): Promise<void> {
  const state = context.core.get();
  const { pending } = state;
  if (pending?.cancelRequested) return cancel(context);
  if (!pending || retryBlocked(state)) return;
  const revision = context.revision;
  context.core.update({ submitting: true });
  try {
    await checkStatus(context, pending, revision);
  } catch (error) {
    if (revision === context.revision) context.core.report(error);
  } finally {
    if (revision === context.revision) context.core.update({ submitting: false });
  }
}

function acknowledgeCancellation(context: ActionContext, receipt: AssistantRequestStatus): void {
  context.revision++;
  if (context.core.pendingId() === receipt.requestId) {
    context.core.accept(receipt);
    context.core.dismiss();
  }
  context.core.update({
    sharedRequests: context.core
      .get()
      .sharedRequests?.filter((request) => request.requestId !== receipt.requestId),
  });
  context.history.invalidate();
}

/** Persists cancellation intent and retains the UUID until the owner confirms a terminal result. */
async function cancel(context: ActionContext): Promise<void> {
  const { pending, cancelling } = context.core.get();
  if (!pending || cancelling || isTerminalAssistantRequest(pending.receipt?.status)) return;
  const requestId = `web:${context.options.username}:${pending.submissionId}`;
  let confirmed = false;
  context.core.update({ cancelling: true, error: null });
  try {
    context.core.save({ ...pending, cancelRequested: true });
    const receipt = await context.options.client.cancel(requestId);
    if (receipt.requestId !== requestId || !isTerminalAssistantRequest(receipt.status))
      throw new AssistantClientError('protocol');
    confirmed = true;
    acknowledgeCancellation(context, receipt);
  } catch (error) {
    context.core.report(error);
  } finally {
    context.core.update({ cancelling: false, ...(confirmed ? { submitting: false } : {}) });
  }
}

/** Persists UUIDs before admission; explicit retries first query status and never replace request identity. */
export function createAssistantActions(
  input: AssistantActionContext,
): Pick<AssistantSession, 'send' | 'retry' | 'cancel'> {
  const context: ActionContext = { ...input, revision: 0 };
  return {
    send: (text) => send(context, text),
    retry: () => retry(context),
    cancel: () => cancel(context),
  };
}
