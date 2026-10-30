import {
  createAssistantConversationDatabase,
  createEnv,
  getChatDatabaseName,
} from '@eddo/core-server';
import { Hono } from 'hono';
import { jwt, sign } from 'hono/jwt';
import nano from 'nano';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readChangeCursor } from '../assistant_cursors';
import { createAssistantProjectionStore } from '../assistant_projection_store';
import { createAssistantRoutes } from '../assistant_routes';

const env = createEnv();
const username = `assistant_${randomUUID().replaceAll('-', '')}`;
const database = createAssistantConversationDatabase(env.COUCHDB_URL, env, username);
const store = createAssistantProjectionStore({ env });
let conversationId: string;

beforeAll(async () => {
  await database.ensureDatabase();
  await database.setupDesignDocuments();
  conversationId = (await database.getOrCreateActive())._id;
});
afterAll(async () => {
  await nano(env.COUCHDB_URL).db.destroy(getChatDatabaseName(env, username));
});

describe('assistant web projection against disposable CouchDB', () => {
  it('paginates actual cross-channel messages without duplicates', async () => {
    for (const channel of ['telegram', 'web', 'telegram'] as const) {
      await database.appendMessage(conversationId, {
        role: 'user',
        content: `From ${channel}`,
        channel,
      });
    }
    const first = await store.history(username, { limit: 2 });
    expect(first.messages.map((message) => message.channel)).toEqual(['web', 'telegram']);
    expect(first.nextCursor).not.toBeNull();
    const older = await store.history(username, { limit: 2, cursor: first.nextCursor! });
    expect(older.messages.map((message) => message.channel)).toEqual(['telegram']);
    expect(older.nextCursor).toBeNull();
  });

  it('replays durable changes across reconnects without exposing message bodies', async () => {
    const since = await store.watermark(username);
    const message = await database.appendMessage(conversationId, {
      role: 'assistant',
      content: 'Private reply',
      channel: 'telegram',
    });
    const first = await store.changes(username, since, new AbortController().signal);
    const replay = await store.changes(username, since, new AbortController().signal);
    expect(first.changes.some((change) => change.change.documentId === message._id)).toBe(true);
    expect(replay).toEqual(first);
    expect(JSON.stringify(first)).not.toContain('Private reply');
  });

  it('streams persisted invalidations through verified JWT authentication and cleans up on disconnect', async () => {
    const checkpoint = (await store.history(username, { limit: 2 })).changeCursor;
    const secret = 'assistant-integration-jwt-secret-at-least-32-characters';
    const app = new Hono();
    app.use('/api/assistant/*', jwt({ secret, alg: 'HS256' }));
    app.route(
      '/api/assistant',
      createAssistantRoutes({
        store,
        authorize: async () => {},
        host: {
          pending: vi.fn().mockResolvedValue({ requests: [], hasMore: false }),
          admit: vi.fn(),
          status: vi.fn(),
        },
      }),
    );
    const token = await sign(
      { username, exp: Math.floor(Date.now() / 1000) + 60 },
      secret,
      'HS256',
    );
    const response = await app.request(`/api/assistant/stream?cursor=${checkpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const reader = response.body!.getReader();
    try {
      const message = await database.appendMessage(conversationId, {
        role: 'assistant',
        content: 'Live reply',
        channel: 'web',
      });
      let frames = '';
      while (!frames.includes(message._id)) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error('Stream ended before persisted invalidation');
        frames += new TextDecoder().decode(chunk.value);
      }
      expect(frames).toContain('event: history-change');
      expect(frames).not.toContain('Live reply');
      expect(readChangeCursor(username, checkpoint)).not.toBe('0');
    } finally {
      await reader.cancel();
    }
  });
});
