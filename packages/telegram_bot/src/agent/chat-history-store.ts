import { createAssistantConversationDatabase, createEnv } from '@eddo/core-server';
import type { AssistantConversationMessageDoc } from '@eddo/core-shared';

import type { BotContext } from '../bot/bot.js';
import type { AgentState } from './helpers/types.js';

export interface AssistantChatHistorySession {
  conversationId: string;
  cacheSessionId: string;
  history: AgentState['history'];
}

export interface PersistAssistantExchangeParams {
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
}

export interface AssistantChatHistoryStore {
  loadConversation: (telegramContext: BotContext) => Promise<AssistantChatHistorySession | null>;
  startNewConversation: (
    telegramContext: BotContext,
  ) => Promise<AssistantChatHistorySession | null>;
  persistExchange: (
    telegramContext: BotContext,
    params: PersistAssistantExchangeParams,
  ) => Promise<void>;
}

/** Converts persisted assistant messages to agent history entries. */
function toHistoryEntry(message: AssistantConversationMessageDoc): AgentState['history'][number] {
  return {
    role: message.role,
    content: message.content,
    timestamp: Date.parse(message.createdAt),
  };
}

/** Returns assistant conversation operations for the authenticated user. */
function getUsername(telegramContext: BotContext): string | null {
  return telegramContext.session.user?.username ?? null;
}

function buildCacheSessionId(username: string, conversationId: string): string {
  return `assistant:${username}:${conversationId}`;
}

function getConversationDatabase(
  telegramContext: BotContext,
): ReturnType<typeof createAssistantConversationDatabase> | null {
  const username = getUsername(telegramContext);
  if (!username) return null;

  const env = createEnv();
  return createAssistantConversationDatabase(env.COUCHDB_URL, env, username);
}

/** Builds a history session for one assistant conversation. */
async function buildHistorySession(
  telegramContext: BotContext,
  conversationId: string,
): Promise<AssistantChatHistorySession | null> {
  const username = getUsername(telegramContext);
  const conversationDb = getConversationDatabase(telegramContext);
  if (!username || !conversationDb) return null;

  const messages = await conversationDb.getMessages(conversationId);
  return {
    conversationId,
    cacheSessionId: buildCacheSessionId(username, conversationId),
    history: messages.map(toHistoryEntry),
  };
}

/** Loads the user's active assistant conversation. */
async function loadConversation(
  telegramContext: BotContext,
): Promise<AssistantChatHistorySession | null> {
  const conversationDb = getConversationDatabase(telegramContext);
  if (!conversationDb) return null;

  await conversationDb.ensureDatabase();
  await conversationDb.setupDesignDocuments();

  const conversation = await conversationDb.getOrCreateActive();
  return buildHistorySession(telegramContext, conversation._id);
}

/** Starts a new active assistant conversation. */
async function startNewConversation(
  telegramContext: BotContext,
): Promise<AssistantChatHistorySession | null> {
  const conversationDb = getConversationDatabase(telegramContext);
  if (!conversationDb) return null;

  await conversationDb.ensureDatabase();
  await conversationDb.setupDesignDocuments();

  const conversation = await conversationDb.startNewConversation();
  return buildHistorySession(telegramContext, conversation._id);
}

/** Persists a completed Telegram exchange in the user's active assistant conversation. */
async function persistExchange(
  telegramContext: BotContext,
  params: PersistAssistantExchangeParams,
): Promise<void> {
  const conversationDb = getConversationDatabase(telegramContext);
  const chatId = telegramContext.chat?.id;
  const userId = telegramContext.from?.id;

  if (!conversationDb || !chatId || !userId) return;

  const channelMetadata = {
    telegram: {
      chatId,
      userId,
      messageId: telegramContext.message?.message_id,
    },
  };

  await conversationDb.appendMessage(params.conversationId, {
    role: 'user',
    content: params.userMessage,
    channel: 'telegram',
    channelMetadata,
  });
  await conversationDb.appendMessage(params.conversationId, {
    role: 'assistant',
    content: params.assistantMessage,
    channel: 'telegram',
    channelMetadata,
  });
}

/** Creates assistant chat history storage backed by the user's chat database. */
export function createAssistantChatHistoryStore(): AssistantChatHistoryStore {
  return {
    loadConversation,
    startNewConversation,
    persistExchange,
  };
}
