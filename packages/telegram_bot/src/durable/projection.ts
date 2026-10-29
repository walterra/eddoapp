import {
  createAssistantConversationDatabase,
  createEnv,
  getChatDatabaseName,
} from '@eddo/core-server';
import type {
  AssistantConversation,
  AssistantConversationMessageDoc,
  AssistantConversationRole,
  AssistantRequest,
} from '@eddo/core-shared';
import { createHash } from 'node:crypto';
import { couchRequest, createCouchEndpoint, type CouchEndpoint } from './couch.js';
import { normalizeTelegramRequest, requestChannelMetadata } from './request_channel.js';
import type { DurableRequestInput } from './state.js';

interface ProjectionOptions {
  username: string;
  input: DurableRequestInput;
  answer: string;
}

export interface AssistantProjectionOptions {
  request: AssistantRequest;
  answer: string;
}

/** Produces stable projection IDs for retries after ambiguous writes. */
export function projectionMessageId(requestId: string, role: AssistantConversationRole): string {
  return `assistant_message_durable_${createHash('sha256').update(requestId).digest('hex')}_${role}`;
}

async function insertMessage(
  endpoint: CouchEndpoint,
  message: AssistantConversationMessageDoc,
): Promise<void> {
  const response = await couchRequest(endpoint, `/${encodeURIComponent(message._id)}`, {
    method: 'PUT',
    body: JSON.stringify(message),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Assistant projection failed: HTTP ${response.status}`);
  }
  if (response.status === 409) {
    const existing = await couchRequest(endpoint, `/${encodeURIComponent(message._id)}`);
    if (!existing.ok) throw new Error('Assistant projection conflict could not be verified');
    const document = (await existing.json()) as AssistantConversationMessageDoc;
    if (
      document.content !== message.content ||
      document.conversationId !== message.conversationId
    ) {
      throw new Error('Assistant projection conflicts with a different message');
    }
  }
}

/** Repairs statistics from messages rather than incrementing twice after a restart. */
async function refreshStats(
  endpoint: CouchEndpoint,
  messages: AssistantConversationMessageDoc[],
  conversationId: string,
): Promise<void> {
  const path = `/${encodeURIComponent(conversationId)}`;
  const response = await couchRequest(endpoint, path);
  if (!response.ok) throw new Error('Assistant conversation lookup failed');
  const conversation = (await response.json()) as AssistantConversation;
  const updated = await couchRequest(endpoint, path, {
    method: 'PUT',
    body: JSON.stringify({
      ...conversation,
      updatedAt: new Date().toISOString(),
      stats: {
        messageCount: messages.length,
        userMessageCount: messages.filter((message) => message.role === 'user').length,
        assistantMessageCount: messages.filter((message) => message.role === 'assistant').length,
      },
    }),
  });
  if (!updated.ok)
    throw new Error(`Assistant statistics projection failed: HTTP ${updated.status}`);
}

/** Preserves the projection callback used by existing Telegram tasks. */
export async function projectDurableExchange(options: ProjectionOptions): Promise<void> {
  return projectAssistantExchange({
    request: normalizeTelegramRequest(options.username, options.input),
    answer: options.answer,
  });
}

/** Projects channel-neutral exchanges using the authenticated account identity. */
export async function projectAssistantExchange(options: AssistantProjectionOptions): Promise<void> {
  const { request: input, answer } = options;
  const username = input.account.username;
  const env = createEnv();
  const database = createAssistantConversationDatabase(env.COUCHDB_URL, env, username);
  const endpoint = createCouchEndpoint(env.COUCHDB_URL, getChatDatabaseName(env, username));
  const messages = await database.getMessages(input.conversationId);
  let sequence = Math.max(0, ...messages.map((message) => message.sequence));
  const content = { user: input.text, assistant: answer };
  for (const role of ['user', 'assistant'] as const) {
    const id = projectionMessageId(input.requestId, role);
    if (messages.some((message) => message._id === id)) continue;
    sequence += 1;
    await insertMessage(endpoint, {
      _id: id,
      version: 'assistant_conversation_message_alpha1',
      conversationId: input.conversationId,
      role,
      content: content[role],
      channel: input.source.channel,
      createdAt: input.createdAt,
      sequence,
      channelMetadata: requestChannelMetadata(input.source),
    });
  }
  await refreshStats(
    endpoint,
    await database.getMessages(input.conversationId),
    input.conversationId,
  );
}
