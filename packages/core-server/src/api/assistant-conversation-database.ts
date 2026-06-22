import {
  createDefaultAssistantConversationStats,
  getRandomHex,
  type AppendAssistantConversationMessageRequest,
  type AssistantConversation,
  type AssistantConversationMessageDoc,
  type AssistantConversationOperations,
  type AssistantConversationState,
  type AssistantConversationStats,
} from '@eddo/core-shared';
import nano from 'nano';

import type { Env } from '../config/env';
import { getChatDatabaseName } from '../utils/database-names';
import { setupAssistantConversationDesignDocuments } from './assistant-conversation-design-docs';

type AssistantConversationDocument =
  | AssistantConversation
  | AssistantConversationMessageDoc
  | AssistantConversationState;

interface AssistantConversationContext {
  db: nano.DocumentScope<AssistantConversationDocument>;
  couchConnection: nano.ServerScope;
  env: Env;
  username: string;
}

const DEFAULT_CONVERSATION_ID = 'assistant_conversation_default';
const STATE_DOCUMENT_ID = 'assistant_conversation_state';

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
  const db = couchConnection.db.use<AssistantConversationDocument>(dbName);
  const context: AssistantConversationContext = { db, couchConnection, env, username };

  return {
    ensureDatabase: () => ensureDatabase(context),
    setupDesignDocuments: () => setupDesignDocuments(context),
    getOrCreateActive: () => getOrCreateActiveConversation(context),
    startNewConversation: () => startNewConversation(context),
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

function createConversation(username: string, active: boolean): AssistantConversation {
  const now = new Date().toISOString();
  return {
    _id: `assistant_conversation_${now}_${getRandomHex(4)}`,
    version: 'assistant_conversation_alpha1',
    username,
    active,
    createdAt: now,
    updatedAt: now,
    stats: createDefaultAssistantConversationStats(),
  };
}

function createDefaultConversation(username: string): AssistantConversation {
  return {
    ...createConversation(username, true),
    _id: DEFAULT_CONVERSATION_ID,
  };
}

function createState(activeConversationId: string): AssistantConversationState {
  return {
    _id: STATE_DOCUMENT_ID,
    version: 'assistant_conversation_state_alpha1',
    activeConversationId,
    updatedAt: new Date().toISOString(),
  };
}

async function getConversation(
  context: AssistantConversationContext,
  conversationId: string,
): Promise<AssistantConversation | null> {
  try {
    return (await context.db.get(conversationId)) as AssistantConversation;
  } catch (error: unknown) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function getState(
  context: AssistantConversationContext,
): Promise<AssistantConversationState | null> {
  try {
    return (await context.db.get(STATE_DOCUMENT_ID)) as AssistantConversationState;
  } catch (error: unknown) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function saveState(
  context: AssistantConversationContext,
  activeConversationId: string,
): Promise<void> {
  const existing = await getState(context);
  const state = createState(activeConversationId);
  await context.db.insert(existing ? { ...state, _rev: existing._rev } : state);
}

async function createActiveConversation(
  context: AssistantConversationContext,
): Promise<AssistantConversation> {
  const conversation = createConversation(context.username, true);
  const result = await context.db.insert(conversation);
  await saveState(context, conversation._id);
  return { ...conversation, _rev: result.rev };
}

async function getOrCreateActiveConversation(
  context: AssistantConversationContext,
): Promise<AssistantConversation> {
  const state = await getState(context);
  if (state) {
    const activeConversation = await getConversation(context, state.activeConversationId);
    if (activeConversation) return activeConversation;
  }

  const defaultConversation = await getConversation(context, DEFAULT_CONVERSATION_ID);
  if (defaultConversation) {
    await saveState(context, defaultConversation._id);
    return defaultConversation.active
      ? defaultConversation
      : markConversationActive(context, defaultConversation);
  }

  const conversation = createDefaultConversation(context.username);
  const result = await context.db.insert(conversation);
  await saveState(context, conversation._id);
  return { ...conversation, _rev: result.rev };
}

async function markConversationActive(
  context: AssistantConversationContext,
  conversation: AssistantConversation,
): Promise<AssistantConversation> {
  const updated = { ...conversation, active: true, updatedAt: new Date().toISOString() };
  const result = await context.db.insert(updated);
  return { ...updated, _rev: result.rev };
}

async function getExistingActiveConversation(
  context: AssistantConversationContext,
): Promise<AssistantConversation | null> {
  const state = await getState(context);
  if (state) return getConversation(context, state.activeConversationId);

  return getConversation(context, DEFAULT_CONVERSATION_ID);
}

async function startNewConversation(
  context: AssistantConversationContext,
): Promise<AssistantConversation> {
  const current = await getExistingActiveConversation(context);
  if (current) {
    await context.db.insert({ ...current, active: false, updatedAt: new Date().toISOString() });
  }

  return createActiveConversation(context);
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
  conversation: AssistantConversation,
  request: AppendAssistantConversationMessageRequest,
): Promise<void> {
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
  const conversation = (await context.db.get(conversationId)) as AssistantConversation;
  const message: AssistantConversationMessageDoc = {
    _id: createMessageDocId(createdAt),
    version: 'assistant_conversation_message_alpha1',
    conversationId,
    role: request.role,
    content: request.content,
    channel: request.channel,
    channelMetadata: request.channelMetadata,
    createdAt,
    sequence: conversation.stats.messageCount + 1,
  };

  const result = await context.db.insert(message);
  await updateConversationStats(context, conversation, request);
  return { ...message, _rev: result.rev };
}

async function getMessages(
  context: AssistantConversationContext,
  conversationId: string,
): Promise<AssistantConversationMessageDoc[]> {
  try {
    const result = await context.db.view('assistant_conversations', 'messages_by_conversation', {
      startkey: [conversationId, 0, '', ''],
      endkey: [conversationId, {}, '\ufff0', '\ufff0'],
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
    .sort((a, b) => a.sequence - b.sequence || a.createdAt.localeCompare(b.createdAt));
}
