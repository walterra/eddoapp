import type { AssistantConversationMessageDoc, AssistantRequest } from '@eddo/core-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectAssistantExchange } from './projection.js';

const fixture = vi.hoisted(() => ({ database: vi.fn(), databaseName: vi.fn() }));
vi.mock('@eddo/core-server', () => ({
  createEnv: () => ({ COUCHDB_URL: 'http://admin:password@localhost:5984' }),
  getChatDatabaseName: fixture.databaseName,
  createAssistantConversationDatabase: fixture.database,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function createWebRequest(): AssistantRequest {
  return {
    account: { username: 'web_only' },
    requestId: 'web:web_only:1',
    conversationId: 'assistant_default',
    text: 'List tasks',
    source: { channel: 'web' },
    createdAt: '2026-10-29T20:00:00.000Z',
    deadline: Date.now() + 300_000,
  };
}

function installTransport(): Map<string, AssistantConversationMessageDoc> {
  const messages = new Map<string, AssistantConversationMessageDoc>();
  fixture.database.mockReturnValue({ getMessages: async () => [...messages.values()] });
  fixture.databaseName.mockReturnValue('eddo_chats_web_only');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/assistant_default')) {
        if (init.method === 'PUT') return new Response('{}', { status: 201 });
        return Response.json({ _id: 'assistant_default', _rev: '1', stats: {} });
      }
      const message = JSON.parse(String(init.body)) as AssistantConversationMessageDoc;
      messages.set(message._id, message);
      return new Response('{}', { status: 201 });
    }),
  );
  return messages;
}

describe('channel-neutral assistant projection', () => {
  it('routes web history by account without Telegram identifiers', async () => {
    const messages = installTransport();
    const request = createWebRequest();

    await projectAssistantExchange({ request, answer: 'Done' });
    await projectAssistantExchange({ request, answer: 'Done' });

    expect(fixture.database).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      'web_only',
    );
    expect(fixture.databaseName).toHaveBeenCalledWith(expect.any(Object), 'web_only');
    expect([...messages.values()]).toEqual([
      expect.objectContaining({ role: 'user', content: 'List tasks', channel: 'web', sequence: 1 }),
      expect.objectContaining({ role: 'assistant', content: 'Done', channel: 'web', sequence: 2 }),
    ]);
    for (const message of messages.values()) expect(message.channelMetadata).toBeUndefined();
  });
});
