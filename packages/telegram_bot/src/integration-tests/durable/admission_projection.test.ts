import {
  createAssistantConversationDatabase,
  createEnv,
  getChatDatabaseName,
} from '@eddo/core-server';
import { assistantProjectionIds, type AssistantRequest } from '@eddo/core-shared';
import nano from 'nano';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHostProjection } from '../../durable/host_projection.js';
import { projectAcceptedMessage, projectAssistantExchange } from '../../durable/projection.js';

const env = createEnv();
const username = `projection_${randomUUID().replaceAll('-', '')}`;
const database = createAssistantConversationDatabase(env.COUCHDB_URL, env, username);
let conversationId: string;
beforeAll(async () => {
  await database.ensureDatabase();
  await database.setupDesignDocuments();
});
beforeEach(async () => {
  conversationId = (await database.startNewConversation())._id;
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await nano(env.COUCHDB_URL).db.destroy(getChatDatabaseName(env, username));
});
function request(): AssistantRequest {
  return {
    account: { username },
    requestId: `web:${username}:${randomUUID()}`,
    source: { channel: 'web' },
    conversationId,
    text: 'Accepted before generation',
    createdAt: new Date().toISOString(),
    deadline: Date.now() + 300_000,
  };
}

describe('admission projection against disposable CouchDB', () => {
  it('reconciles an ambiguous committed write with stable message IDs and exact statistics', async () => {
    const input = request();
    const transport = globalThis.fetch;
    let interrupted = false;
    vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
      const response = await transport(url, init);
      if (
        !interrupted &&
        String(url).endsWith(`/${encodeURIComponent(conversationId)}`) &&
        init?.method === 'PUT'
      ) {
        interrupted = true;
        void response.body?.cancel();
        throw new Error('Lost statistics acknowledgement');
      }
      return response;
    });
    await expect(projectAcceptedMessage(input)).rejects.toThrow('Lost statistics acknowledgement');
    await projectAcceptedMessage(input);
    expect((await database.getMessages(conversationId)).map((message) => message.role)).toEqual([
      'user',
    ]);
    expect((await database.getOrCreateActive()).stats).toEqual({
      messageCount: 1,
      userMessageCount: 1,
      assistantMessageCount: 0,
    });
    await projectAssistantExchange({ request: input, answer: 'Reply' });
    await projectAssistantExchange({ request: input, answer: 'Reply' });
    const ids = await assistantProjectionIds(input.requestId);
    expect((await database.getMessages(conversationId)).map((message) => message._id)).toEqual([
      ids.user,
      ids.assistant,
    ]);
    expect((await database.getOrCreateActive()).stats).toEqual({
      messageCount: 2,
      userMessageCount: 1,
      assistantMessageCount: 1,
    });
  });

  it('serializes concurrent admission and reply projections through the account writer', async () => {
    const writer = createHostProjection(username);
    const first = request();
    const second = request();
    await Promise.all([
      writer.projectAccepted!(first),
      writer.projectAccepted!(second),
      writer.project(first, 'First'),
      writer.project(second, 'Second'),
    ]);
    const messages = await database.getMessages(conversationId);
    expect(messages).toHaveLength(4);
    expect(new Set(messages.map((message) => message.sequence)).size).toBe(4);
    expect((await database.getOrCreateActive()).stats).toEqual({
      messageCount: 4,
      userMessageCount: 2,
      assistantMessageCount: 2,
    });
  });
});
