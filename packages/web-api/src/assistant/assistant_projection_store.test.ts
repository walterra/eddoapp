// @vitest-environment node
import { getChatDatabaseName, validateEnv } from '@eddo/core-server';
import type { AssistantConversationMessageDoc } from '@eddo/core-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changeCursor, historyCursor } from './assistant_cursors';
import { createAssistantProjectionStore } from './assistant_projection_store';

const fixture = vi.hoisted(() => ({ info: vi.fn(), get: vi.fn(), view: vi.fn(), use: vi.fn() }));
vi.mock('nano', () => ({ default: () => ({ db: { get: fixture.info, use: fixture.use } }) }));
const env = validateEnv({ NODE_ENV: 'test', COUCHDB_URL: 'http://admin:password@localhost:5984' });
const conversation = {
  _id: 'active',
  version: 'assistant_conversation_alpha1',
  username: 'alice',
  active: true,
  createdAt: '2026-10-29T00:00:00Z',
  updatedAt: '2026-10-29T00:00:00Z',
  stats: { messageCount: 4, userMessageCount: 2, assistantMessageCount: 2 },
};
function message(id: string, sequence: number): AssistantConversationMessageDoc {
  return {
    _id: id,
    version: 'assistant_conversation_message_alpha1',
    conversationId: 'active',
    content: id,
    role: 'user',
    channel: 'telegram',
    createdAt: '2026-10-29T00:00:00Z',
    sequence,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.info.mockResolvedValue({ update_seq: '12-checkpoint' });
  fixture.use.mockReturnValue({ get: fixture.get, view: fixture.view });
  fixture.get.mockImplementation(async (id: string) =>
    id === 'assistant_conversation_state' ? { activeConversationId: 'active' } : conversation,
  );
});

describe('read-only assistant projection store', () => {
  it('paginates by the complete sequence/time/id key without skipping ties', async () => {
    fixture.view
      .mockResolvedValueOnce({
        rows: [message('d', 2), message('c', 2), message('b', 1), message('a', 1)].map((doc) => ({
          doc,
        })),
      })
      .mockResolvedValueOnce({
        rows: [message('c', 2), message('b', 1), message('a', 1)].map((doc) => ({ doc })),
      });
    const store = createAssistantProjectionStore({ env });
    const first = await store.history('alice', { limit: 2 });
    expect(first.messages.map((doc) => doc._id)).toEqual(['c', 'd']);
    expect(first.changeCursor).toBe(changeCursor('alice', '12-checkpoint'));
    const second = await store.history('alice', { limit: 2, cursor: first.nextCursor! });
    expect(second.messages.map((doc) => doc._id)).toEqual(['a', 'b']);
    expect(second.nextCursor).toBeNull();
    expect(fixture.view.mock.calls[1][2].startkey).toEqual([
      'active',
      2,
      '2026-10-29T00:00:00Z',
      'c',
    ]);
    expect(fixture.use).toHaveBeenCalledWith(getChatDatabaseName(env, 'alice'));
  });

  it('rejects foreign-account and foreign-conversation cursors before reading messages', async () => {
    const store = createAssistantProjectionStore({ env });
    for (const cursor of [
      historyCursor('bob', 'active', [1, 'time', 'id']),
      historyCursor('alice', 'other', [1, 'time', 'id']),
    ]) {
      await expect(store.history('alice', { limit: 2, cursor })).rejects.toMatchObject({
        status: 400,
      });
    }
    expect(fixture.view).not.toHaveBeenCalled();
  });

  it('returns empty history for a missing projection without provisioning anything', async () => {
    fixture.info.mockRejectedValue({ statusCode: 404 });
    fixture.get.mockRejectedValue({ statusCode: 404 });
    const result = await createAssistantProjectionStore({ env }).history('alice', { limit: 30 });
    expect(result).toEqual({
      conversation: null,
      messages: [],
      nextCursor: null,
      changeCursor: changeCursor('alice', '0'),
    });
    expect(fixture.view).not.toHaveBeenCalled();
  });

  it('filters changes server-side and emits no sandbox records or message bodies', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        last_seq: '15-checkpoint',
        results: [
          { id: 'assistant_message_1', seq: '13-checkpoint', doc: { content: 'private body' } },
          { id: 'sandbox_session_1', seq: '14-checkpoint' },
          { id: 'assistant_conversation_state', seq: '15-checkpoint' },
        ],
      }),
    );
    const store = createAssistantProjectionStore({ env, fetch: transport });
    const result = await store.changes('alice', '12-checkpoint', new AbortController().signal);
    expect(result.changes.map((entry) => entry.change.documentId)).toEqual([
      'assistant_message_1',
      'assistant_conversation_state',
    ]);
    expect(JSON.stringify(result)).not.toContain('private body');
    const [url, options] = transport.mock.calls[0];
    expect(String(url)).not.toContain('password');
    expect(String(url)).toContain(`/${getChatDatabaseName(env, 'alice')}/_changes`);
    expect(String(url)).toContain('since=12-checkpoint');
    expect(String(url)).toContain('filter=_selector');
    expect(String(options?.body)).toContain('assistant_conversation_message_alpha1');
  });
});
