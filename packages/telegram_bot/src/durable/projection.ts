import { assistantRequest, requestChannelMetadata } from '@eddo/assistant-server/request_channel';
import type { RuntimeRequestInput } from '@eddo/assistant-server/state';
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

interface ProjectionOptions {
  username: string;
  input: RuntimeRequestInput;
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

function verifyMessage(
  document: AssistantConversationMessageDoc,
  message: AssistantConversationMessageDoc,
): void {
  if (
    document.content !== message.content ||
    document.conversationId !== message.conversationId ||
    document.role !== message.role ||
    document.channel !== message.channel
  )
    throw new Error('Assistant projection conflicts with a different message');
}

async function insertMessage(
  endpoint: CouchEndpoint,
  message: AssistantConversationMessageDoc,
  previous?: AssistantConversationMessageDoc,
): Promise<void> {
  if (previous) {
    verifyMessage(previous, message);
    return;
  }
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
    verifyMessage(document, message);
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
    request: assistantRequest(options.username, options.input),
    answer: options.answer,
  });
}

interface MessageProjection {
  request: AssistantRequest;
  content: Partial<Record<AssistantConversationRole, string>>;
}

/** Projects accepted text without waiting for generation or transport delivery. */
export async function projectAcceptedMessage(request: AssistantRequest): Promise<void> {
  await projectMessages({ request, content: { user: request.text } });
}

/** Projects channel-neutral exchanges using the authenticated account identity. */
export async function projectAssistantExchange(options: AssistantProjectionOptions): Promise<void> {
  await projectMessages({
    request: options.request,
    content: { user: options.request.text, assistant: options.answer },
  });
}

async function projectMessages(options: MessageProjection): Promise<void> {
  const { request: input, content } = options;
  const username = input.account.username;
  const env = createEnv();
  const database = createAssistantConversationDatabase(env.COUCHDB_URL, env, username);
  const endpoint = createCouchEndpoint(env.COUCHDB_URL, getChatDatabaseName(env, username));
  const messages = await database.getMessages(input.conversationId);
  let sequence = Math.max(0, ...messages.map((message) => message.sequence));
  for (const role of ['user', 'assistant'] as const) {
    const text = content[role];
    if (text === undefined) continue;
    const id = projectionMessageId(input.requestId, role);
    const existing = messages.find((message) => message._id === id);
    if (!existing) sequence += 1;
    await insertMessage(
      endpoint,
      {
        _id: id,
        version: 'assistant_conversation_message_alpha1',
        conversationId: input.conversationId,
        role,
        content: text,
        channel: input.source.channel,
        createdAt: input.createdAt,
        sequence: existing?.sequence ?? sequence,
        channelMetadata: requestChannelMetadata(input.source),
      },
      existing,
    );
  }
  await refreshStats(
    endpoint,
    await database.getMessages(input.conversationId),
    input.conversationId,
  );
}
