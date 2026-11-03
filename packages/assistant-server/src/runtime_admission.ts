import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { Conversation, Harness, TaskId } from '@earendil-works/pi-durable';
import type { AssistantRequestStatus } from '@eddo/core-shared';
import { ensureLegacyHistory } from './legacy_context.js';
import { PendingRequests } from './pending_requests.js';
import { cancelRequest } from './request_cancellation.js';
import { assistantRequest } from './request_channel.js';
import { AssistantRequestConflictError, requestPayloadHash } from './request_identity.js';
import { parseAssistantRequest } from './request_schema.js';
import { createRequestTask } from './request_task.js';
import type { ResolvedRuntimeOptions } from './runtime.js';
import {
  ConversationMap,
  RequestCancellations,
  RequestMap,
  RequestPayloads,
  type RuntimeRequestInput,
} from './state.js';

/** Finds or creates the native conversation without forking concurrent first submissions. */
async function getConversation(
  harness: Harness,
  options: ResolvedRuntimeOptions,
  externalId: string,
): Promise<Conversation> {
  const mapping = await harness.snapshot(ConversationMap, context);
  const existing = mapping?.conversations[externalId];
  if (existing !== undefined) {
    const conversation = await harness.conversation(existing, context);
    if (!conversation) throw new Error('Durable conversation mapping is invalid');
    return conversation;
  }
  return harness.createConversation(
    {
      ownership: { kind: 'ownerless' },
      agent: { model: options.model, thinkingLevel: options.thinkingLevel },
      init: async (tx, conversation) => {
        (await tx.doc(ConversationMap)).conversations[externalId] = conversation;
      },
    },
    context,
  );
}

/** Rejects cross-account and unpinned Telegram destinations before journal admission. */
function validateOwner(options: ResolvedRuntimeOptions, input: RuntimeRequestInput): void {
  const request =
    'account' in input ? parseAssistantRequest(input) : assistantRequest(options.username, input);
  if (request.source.channel === 'web' && !request.requestId.startsWith(`web:${options.username}:`))
    throw new Error('Web request identity must be scoped to its account');
  if (request.account.username !== options.username)
    throw new Error('Durable request does not match the journal owner');
  if (
    request.source.channel === 'telegram' &&
    (request.source.telegram.userId !== options.telegramId ||
      request.source.telegram.chatId !== options.telegramId)
  )
    throw new Error('Durable request does not match the journal owner');
}

/** Retains accepted payload conflicts, including after cancellation. */
async function existingRequest(
  harness: Harness,
  input: RuntimeRequestInput,
  hash: string | undefined,
): Promise<TaskId<string> | undefined> {
  const previous = (await harness.snapshot(RequestMap, context))?.tasks[input.requestId];
  if (previous === undefined) return;
  const payloads = await harness.snapshot(RequestPayloads, context);
  if (hash && payloads?.hashes[input.requestId] !== hash)
    throw new AssistantRequestConflictError(
      'Assistant request identity was reused with a different payload',
    );
  return previous;
}

/** Admits one request while retaining legacy deduplication across active-conversation changes. */
async function admit(
  harness: Harness,
  options: ResolvedRuntimeOptions,
  input: RuntimeRequestInput,
): Promise<TaskId<string> | undefined> {
  validateOwner(options, input);
  if ('account' in input) await options.authorize(input);
  const hash = 'account' in input ? requestPayloadHash(input) : undefined;
  const previous = await existingRequest(harness, input, hash);
  if (previous !== undefined) return previous;
  if ((await harness.snapshot(RequestCancellations, context))?.requests[input.requestId]) return;
  const conversation = await getConversation(harness, options, input.conversationId);
  if (options.legacyHistory)
    await ensureLegacyHistory(conversation, input.conversationId, options.legacyHistory);
  return conversation.commit(async (tx) => {
    const taskId = await tx.createTask(createRequestTask(options), input, {
      ownership: { kind: 'conversation' },
      background: true,
    });
    (await tx.doc(RequestMap)).tasks[input.requestId] = taskId;
    (await tx.doc(PendingRequests)).ids[input.requestId] = true;
    if (hash) (await tx.doc(RequestPayloads)).hashes[input.requestId] = hash;
    return taskId;
  }, context);
}

export interface RuntimeAdmission {
  submit: (input: RuntimeRequestInput) => Promise<TaskId<string> | undefined>;
  cancel: (requestId: string, conversationId: string) => Promise<AssistantRequestStatus>;
}

/** Serializes admission and cancellation to fence late submissions without a second execution owner. */
export function createRuntimeAdmission(
  harness: Harness,
  options: ResolvedRuntimeOptions,
): RuntimeAdmission {
  let admission = Promise.resolve();
  const serialize = <T>(action: () => Promise<T>): Promise<T> => {
    const pending = admission.then(action);
    admission = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  };
  return {
    submit: (input) => serialize(() => admit(harness, options, input)),
    cancel: (requestId, conversationId) =>
      serialize(() => {
        if (!requestId.startsWith(`web:${options.username}:`))
          throw new Error('Cancellation identity is not account-scoped');
        return cancelRequest(harness, requestId, conversationId);
      }),
  };
}
