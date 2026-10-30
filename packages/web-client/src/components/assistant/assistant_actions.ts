import { assistantProjectionIds } from '@eddo/core-shared';
import type { AssistantLiveConnection } from './assistant_connection';
import type { AssistantHistoryController } from './assistant_history_controller';
import { isTerminalAssistantRequest, type AssistantStateCore } from './assistant_state';
import {
  AssistantClientError,
  type AssistantPendingRequest,
  type AssistantSession,
  type AssistantSessionOptions,
} from './assistant_types';

export interface AssistantActionContext {
  options: AssistantSessionOptions;
  core: AssistantStateCore;
  live: AssistantLiveConnection;
  history: AssistantHistoryController;
}
async function submit(
  context: AssistantActionContext,
  pending: AssistantPendingRequest,
): Promise<void> {
  context.core.update({ submitting: true, error: null });
  try {
    const receipt = await context.options.client.admit(pending);
    context.core.accept(receipt);
    context.history.invalidate();
  } catch (error) {
    context.core.report(error);
  } finally {
    context.core.update({ submitting: false });
  }
}
function requireBrowserIdentity(options: AssistantSessionOptions): void {
  if (!options.uuid && typeof globalThis.crypto?.randomUUID !== 'function')
    throw new AssistantClientError('unsupported');
  if (!options.projectionIds && !globalThis.crypto?.subtle)
    throw new AssistantClientError('unsupported');
}
async function pendingRequest(
  context: AssistantActionContext,
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
async function send(context: AssistantActionContext, text: string): Promise<void> {
  const state = context.core.get();
  if (
    state.pending ||
    state.submitting ||
    state.loading ||
    state.connection === 'blocked' ||
    state.error === 'storage'
  )
    return;
  context.core.update({ submitting: true });
  try {
    const pending = await pendingRequest(context, text);
    context.core.save(pending);
    context.live.restart();
    await submit(context, pending);
  } catch (error) {
    context.core.report(error);
    context.core.update({ submitting: false });
  }
}
async function retry(context: AssistantActionContext): Promise<void> {
  const { pending, submitting } = context.core.get();
  if (!pending || submitting || isTerminalAssistantRequest(pending.receipt?.status)) return;
  context.core.update({ submitting: true });
  try {
    const receipt = await context.options.client.status(
      `web:${context.options.username}:${pending.submissionId}`,
    );
    if (receipt) {
      context.core.accept(receipt);
      context.history.invalidate();
    } else if (!pending.receipt) await submit(context, pending);
    else context.core.update({ error: 'unavailable' });
  } catch (error) {
    context.core.report(error);
  } finally {
    context.core.update({ submitting: false });
  }
}

/** Persists UUIDs before admission; explicit retries first query status and never replace request identity. */
export function createAssistantActions(
  context: AssistantActionContext,
): Pick<AssistantSession, 'send' | 'retry'> {
  return { send: (text) => send(context, text), retry: () => retry(context) };
}
