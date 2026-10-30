import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { Conversation, Harness, TaskId } from '@earendil-works/pi-durable';
import { ensureLegacyHistory } from './legacy_context.js';
import { assistantRequest } from './request_channel.js';
import { requestPayloadHash } from './request_identity.js';
import { parseAssistantRequest } from './request_schema.js';
import { createRequestTask } from './request_task.js';
import type { ResolvedRuntimeOptions } from './runtime.js';
import { ConversationMap, RequestMap, RequestPayloads, type RuntimeRequestInput } from './state.js';

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

/** Admits one request while retaining legacy deduplication across active-conversation changes. */
async function admit(
  harness: Harness,
  options: ResolvedRuntimeOptions,
  input: RuntimeRequestInput,
): Promise<TaskId<string>> {
  validateOwner(options, input);
  if ('account' in input) await options.authorize(input);
  const previous = await harness.snapshot(RequestMap, context);
  const hash = 'account' in input ? requestPayloadHash(input) : undefined;
  if (previous?.tasks[input.requestId] !== undefined) {
    const payloads = await harness.snapshot(RequestPayloads, context);
    if (hash && payloads?.hashes[input.requestId] !== hash)
      throw new Error('Assistant request identity was reused with a different payload');
    return previous.tasks[input.requestId];
  }
  const conversation = await getConversation(harness, options, input.conversationId);
  if (options.legacyHistory)
    await ensureLegacyHistory(conversation, input.conversationId, options.legacyHistory);
  return conversation.commit(async (tx) => {
    const taskId = await tx.createTask(createRequestTask(options), input, {
      ownership: { kind: 'conversation' },
      background: true,
    });
    (await tx.doc(RequestMap)).tasks[input.requestId] = taskId;
    if (hash) (await tx.doc(RequestPayloads)).hashes[input.requestId] = hash;
    return taskId;
  }, context);
}

/** Serializes admission without blocking on generation, delivery, or earlier admission failures. */
export function createRuntimeAdmission(
  harness: Harness,
  options: ResolvedRuntimeOptions,
): (input: RuntimeRequestInput) => Promise<TaskId<string>> {
  let admission = Promise.resolve();
  return (input) => {
    const pending = admission.then(() => admit(harness, options, input));
    admission = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  };
}
