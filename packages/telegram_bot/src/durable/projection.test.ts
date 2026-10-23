import type { AssistantConversationMessageDoc } from '@eddo/core-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectDurableExchange, projectionMessageId } from './projection.js';
import { createTestInput } from './test_helpers.js';

const fixture = vi.hoisted(() => ({
  messages: new Map<string, AssistantConversationMessageDoc>(),
  getMessages: vi.fn(),
}));
vi.mock('@eddo/core-server', () => ({
  createEnv: () => ({ COUCHDB_URL: 'http://admin:password@localhost:5984' }),
  getChatDatabaseName: () => 'eddo_chats_alice',
  createAssistantConversationDatabase: () => ({ getMessages: fixture.getMessages }),
}));

beforeEach(() => {
  fixture.messages.clear();
  fixture.getMessages.mockImplementation(async () => [...fixture.messages.values()]);
});
afterEach(() => vi.unstubAllGlobals());

function installTransport(): ReturnType<typeof vi.fn> {
  const transport = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith('/assistant_default')) {
      if (init.method === 'PUT') return new Response('{}', { status: 201 });
      return Response.json({ _id: 'assistant_default', _rev: '1', stats: {} });
    }
    const message = JSON.parse(String(init.body)) as AssistantConversationMessageDoc;
    fixture.messages.set(message._id, message);
    return new Response('{}', { status: 201 });
  });
  vi.stubGlobal('fetch', transport);
  return transport;
}

describe('durable chat projection', () => {
  it('uses stable message IDs and repairs statistics on repeated projection', async () => {
    const transport = installTransport();
    const options = { username: 'alice', input: createTestInput(), answer: 'Done' };
    await projectDurableExchange(options);
    await projectDurableExchange(options);
    expect(fixture.messages.size).toBe(2);
    const updates = transport.mock.calls.filter(([url]) =>
      String(url).endsWith('/assistant_default'),
    );
    const last = JSON.parse(String(updates.at(-1)?.[1].body));
    expect(last.stats).toEqual({ messageCount: 2, userMessageCount: 1, assistantMessageCount: 1 });
    expect(projectionMessageId(options.input.requestId, 'user')).not.toBe(
      projectionMessageId(options.input.requestId, 'assistant'),
    );
  });

  it('recovers a partial exchange without duplicating the user message', async () => {
    const transport = installTransport();
    transport
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const message = JSON.parse(String(init.body)) as AssistantConversationMessageDoc;
        fixture.messages.set(message._id, message);
        return new Response('{}', { status: 201 });
      })
      .mockRejectedValueOnce(new Error('connection lost'));
    const options = { username: 'alice', input: createTestInput(), answer: 'Done' };
    await expect(projectDurableExchange(options)).rejects.toThrow('connection lost');
    expect(fixture.messages.size).toBe(1);
    await projectDurableExchange(options);
    expect([...fixture.messages.values()].map((message) => message.sequence)).toEqual([1, 2]);
  });
});
