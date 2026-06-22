import { createAssistantConversationDatabase, createEnv } from '@eddo/core-server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BotContext } from '../bot/bot.js';
import { createAssistantChatHistoryStore } from './chat-history-store.js';

vi.mock('@eddo/core-server', () => ({
  createAssistantConversationDatabase: vi.fn(),
  createEnv: vi.fn(),
}));

interface MockConversationDb {
  ensureDatabase: ReturnType<typeof vi.fn>;
  setupDesignDocuments: ReturnType<typeof vi.fn>;
  getOrCreateDefault: ReturnType<typeof vi.fn>;
  getMessages: ReturnType<typeof vi.fn>;
  appendMessage: ReturnType<typeof vi.fn>;
}

function createMockContext(): BotContext {
  return {
    session: { userId: '123', lastActivity: new Date(), context: {}, user: { username: 'alice' } },
    chat: { id: 456 },
    from: { id: 789 },
    message: { message_id: 111 },
  } as unknown as BotContext;
}

function createMockConversationDb(): MockConversationDb {
  return {
    ensureDatabase: vi.fn().mockResolvedValue(undefined),
    setupDesignDocuments: vi.fn().mockResolvedValue(undefined),
    getOrCreateDefault: vi.fn().mockResolvedValue({ _id: 'assistant_conversation_default' }),
    getMessages: vi.fn().mockResolvedValue([]),
    appendMessage: vi.fn().mockResolvedValue({}),
  };
}

describe('chat-history-store', () => {
  let conversationDb: MockConversationDb;

  beforeEach(() => {
    vi.clearAllMocks();
    conversationDb = createMockConversationDb();
    vi.mocked(createEnv).mockReturnValue({ COUCHDB_URL: 'http://localhost:5984' } as ReturnType<
      typeof createEnv
    >);
    vi.mocked(createAssistantConversationDatabase).mockReturnValue(
      conversationDb as ReturnType<typeof createAssistantConversationDatabase>,
    );
  });

  it('loads default assistant conversation history for the authenticated user', async () => {
    conversationDb.getMessages.mockResolvedValue([
      {
        role: 'user',
        content: 'remember my preference',
        createdAt: '2026-06-22T10:00:00.000Z',
      },
      {
        role: 'assistant',
        content: 'noted',
        createdAt: '2026-06-22T10:00:01.000Z',
      },
    ]);

    const result = await createAssistantChatHistoryStore().loadConversation(createMockContext());

    expect(createAssistantConversationDatabase).toHaveBeenCalledWith(
      'http://localhost:5984',
      expect.any(Object),
      'alice',
    );
    expect(conversationDb.ensureDatabase).toHaveBeenCalledOnce();
    expect(conversationDb.setupDesignDocuments).toHaveBeenCalledOnce();
    expect(result).toEqual({
      conversationId: 'assistant_conversation_default',
      cacheSessionId: 'assistant:alice:assistant_conversation_default',
      history: [
        { role: 'user', content: 'remember my preference', timestamp: 1782122400000 },
        { role: 'assistant', content: 'noted', timestamp: 1782122401000 },
      ],
    });
  });

  it('persists Telegram user and assistant messages to the default conversation', async () => {
    await createAssistantChatHistoryStore().persistExchange(createMockContext(), {
      conversationId: 'assistant_conversation_default',
      userMessage: 'what next?',
      assistantMessage: 'your next action is...',
    });

    expect(conversationDb.appendMessage).toHaveBeenNthCalledWith(
      1,
      'assistant_conversation_default',
      {
        role: 'user',
        content: 'what next?',
        channel: 'telegram',
        channelMetadata: { telegram: { chatId: 456, userId: 789, messageId: 111 } },
      },
    );
    expect(conversationDb.appendMessage).toHaveBeenNthCalledWith(
      2,
      'assistant_conversation_default',
      {
        role: 'assistant',
        content: 'your next action is...',
        channel: 'telegram',
        channelMetadata: { telegram: { chatId: 456, userId: 789, messageId: 111 } },
      },
    );
  });
});
