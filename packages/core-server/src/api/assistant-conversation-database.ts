import {
  createDefaultAssistantConversationStats,
  getRandomHex,
  type AppendAssistantConversationMessageRequest,
  type AssistantConversation,
  type AssistantConversationMessageDoc,
  type AssistantConversationOperations,
  type AssistantConversationStats,
} from '@eddo/core-shared';
import nano from 'nano';

import type { Env } from '../config/env';
import { getChatDatabaseName } from '../utils/database-names';
import { setupAssistantConversationDesignDocuments } from './assistant-conversation-design-docs';

interface AssistantConversationContext {
  db: nano.DocumentScope<AssistantConversation | AssistantConversationMessageDoc>;
  couchConnection: nano.ServerScope;
  env: Env;
  username: string;
}

const DEFAULT_CONVERSATION_ID = 'assistant_conversation_default';

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404,
  );
}

function createMessageDocId(createdAt: string): string {
  return `assistant_message_${createdAt}_${getRandomHex(4)}`;
}

/** Creates assistant conversation operations for one user's chat database. */
export function createAssistantConversationDatabase(
  couchUrl: string,
  env: Env,
  username: string,
): AssistantConversationOperations {
  const couchConnection = nano(couchUrl);
  const dbName = getChatDatabaseName(env, username);
  const db = couchConnection.db.use<AssistantConversation | AssistantConversationMessageDoc>(
    dbName,
  );
  const context: AssistantConversationContext = { db, couchConnection, env, username };

  return {
    ensureDatabase: () => ensureDatabase(context),
    setupDesignDocuments: () => setupDesignDocuments(context),
    getOrCreateDefault: () => getOrCreateDefaultConversation(context),
    getMessages: (conversationId) => getMessages(context, conversationId),
    appendMessage: (conversationId, request) => appendMessage(context, conversationId, request),
  };
}

async function ensureDatabase(context: AssistantConversationContext): Promise<void> {
  const dbName = getChatDatabaseName(context.env, context.username);
  try {
    await context.couchConnection.db.get(dbName);
  } catch (error: unknown) {
    if (!isNotFoundError(error)) throw error;
    await context.couchConnection.db.create(dbName);
  }
}

async function setupDesignDocuments(context: AssistantConversationContext): Promise<void> {
  await setupAssistantConversationDesignDocuments(
    context.couchConnection,
    getChatDatabaseName(context.env, context.username),
  );
}

function createDefaultConversation(username: string): AssistantConversation {
  const now = new Date().toISOString();
  return {
    _id: DEFAULT_CONVERSATION_ID,
    version: 'assistant_conversation_alpha1',
    username,
    createdAt: now,
    updatedAt: now,
    stats: createDefaultAssistantConversationStats(),
  };
}

async function getOrCreateDefaultConversation(
  context: AssistantConversationContext,
): Promise<AssistantConversation> {
  try {
    return (await context.db.get(DEFAULT_CONVERSATION_ID)) as AssistantConversation;
  } catch (error: unknown) {
    if (!isNotFoundError(error)) throw error;
    const conversation = createDefaultConversation(context.username);
    const result = await context.db.insert(conversation);
    return { ...conversation, _rev: result.rev };
  }
}

function applyStatsDelta(
  stats: AssistantConversationStats,
  request: AppendAssistantConversationMessageRequest,
): AssistantConversationStats {
  return {
    messageCount: stats.messageCount + 1,
    userMessageCount: stats.userMessageCount + (request.role === 'user' ? 1 : 0),
    assistantMessageCount: stats.assistantMessageCount + (request.role === 'assistant' ? 1 : 0),
  };
}

async function updateConversationStats(
  context: AssistantConversationContext,
  conversationId: string,
  request: AppendAssistantConversationMessageRequest,
): Promise<void> {
  const conversation = (await context.db.get(conversationId)) as AssistantConversation;
  await context.db.insert({
    ...conversation,
    stats: applyStatsDelta(conversation.stats, request),
    updatedAt: new Date().toISOString(),
  });
}

async function appendMessage(
  context: AssistantConversationContext,
  conversationId: string,
  request: AppendAssistantConversationMessageRequest,
): Promise<AssistantConversationMessageDoc> {
  const createdAt = new Date().toISOString();
  const message: AssistantConversationMessageDoc = {
    _id: createMessageDocId(createdAt),
    version: 'assistant_conversation_message_alpha1',
    conversationId,
    role: request.role,
    content: request.content,
    channel: request.channel,
    channelMetadata: request.channelMetadata,
    createdAt,
  };

  const result = await context.db.insert(message);
  await updateConversationStats(context, conversationId, request);
  return { ...message, _rev: result.rev };
}

async function getMessages(
  context: AssistantConversationContext,
  conversationId: string,
): Promise<AssistantConversationMessageDoc[]> {
  try {
    const result = await context.db.view('assistant_conversations', 'messages_by_conversation', {
      startkey: [conversationId, '', ''],
      endkey: [conversationId, '\ufff0', '\ufff0'],
      include_docs: true,
    });
    return result.rows.map((row) => row.doc as AssistantConversationMessageDoc).filter(Boolean);
  } catch (error: unknown) {
    if (!isNotFoundError(error)) throw error;
    return getMessagesFallback(context, conversationId);
  }
}

async function getMessagesFallback(
  context: AssistantConversationContext,
  conversationId: string,
): Promise<AssistantConversationMessageDoc[]> {
  const result = await context.db.list({ include_docs: true });
  return result.rows
    .map((row) => row.doc as AssistantConversationMessageDoc | undefined)
    .filter((doc): doc is AssistantConversationMessageDoc =>
      Boolean(
        doc?.version === 'assistant_conversation_message_alpha1' &&
        doc.conversationId === conversationId,
      ),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
