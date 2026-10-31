import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import type { AssistantHistoryPage, AssistantRequestStatus } from '@eddo/core-shared';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestInput } from '../../durable/test_helpers.js';
import { sharedAssistantFixture, type SharedAssistantFixture } from './shared_assistant_fixture.js';

const fixtures: SharedAssistantFixture[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()));
});
async function fixture(linked = true): Promise<SharedAssistantFixture> {
  const test = await sharedAssistantFixture(linked);
  fixtures.push(test);
  return test;
}
async function history(test: SharedAssistantFixture): Promise<AssistantHistoryPage> {
  const response = await test.app.request('/api/assistant/conversation', { headers: test.headers });
  expect(response.status).toBe(200);
  return (await response.json()) as AssistantHistoryPage;
}
function telegram(test: SharedAssistantFixture, requestId: string, text = 'Discuss Alpha') {
  return createTestInput({ conversationId: test.conversationId, requestId, text });
}
function modelResponses(test: SharedAssistantFixture): void {
  test.options.client.tools = [
    {
      name: 'createTodo',
      description: 'Create todo',
      inputSchema: {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
    },
  ];
  test.options.client.invoke = vi
    .fn()
    .mockResolvedValue([{ type: 'text', text: 'Created Alpha task' }]);
  test.provider.setResponses([
    fauxAssistantMessage('Alpha confirmed'),
    (context) => {
      expect(JSON.stringify(context.messages)).toContain('Alpha confirmed');
      return fauxAssistantMessage(fauxToolCall('createTodo', { title: 'Alpha followup' }), {
        stopReason: 'toolUse',
      });
    },
    fauxAssistantMessage('Created Alpha followup'),
    (context) => {
      expect(JSON.stringify(context.messages)).toContain('Created Alpha followup');
      return fauxAssistantMessage('Web created Alpha followup');
    },
    (context) => {
      expect(JSON.stringify(context.messages)).toContain('Created Alpha followup');
      return fauxAssistantMessage('---BRIEFING-START---\nAlpha report');
    },
  ]);
}
async function admitInterruptedWeb(test: SharedAssistantFixture): Promise<string> {
  test.interruptProjection();
  const id = randomUUID();
  const response = await test.app.request('/api/assistant/messages', {
    method: 'POST',
    headers: test.headers,
    body: JSON.stringify({ requestId: id, text: 'Create the followup' }),
  });
  expect(response.status).toBe(202);
  const requestId = `web:${test.username}:${id}`;
  await vi.waitFor(async () =>
    expect((await test.current().getRequestStatus(requestId))?.status).toBe('projecting'),
  );
  const pending = await test.app.request('/api/assistant/requests', { headers: test.headers });
  expect(await pending.json()).toMatchObject({
    requests: [expect.objectContaining({ requestId, status: 'projecting' })],
  });
  expect((await history(test)).messages.map((message) => message.role)).toEqual([
    'user',
    'assistant',
    'user',
  ]);
  expect(test.options.client.invoke).toHaveBeenCalledOnce();
  expect(test.options.send).toHaveBeenCalledOnce();
  expect(test.options.progress).not.toHaveBeenCalled();
  return requestId;
}
async function streamReplay(test: SharedAssistantFixture, cursor: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  const response = await test.app.request(
    `/api/assistant/stream?cursor=${encodeURIComponent(cursor)}`,
    { headers: test.headers, signal: controller.signal },
  );
  const reader = response.body!.getReader();
  try {
    let frames = '';
    while (
      !frames.includes('event: history-change') ||
      !frames.includes('event: pending-requests')
    ) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('Missing replayed lifecycle or history');
      frames += new TextDecoder().decode(chunk.value);
    }
    expect(frames).not.toContain('Created Alpha followup');
    expect(frames).not.toContain('fixture-current-key');
  } finally {
    clearTimeout(timer);
    controller.abort();
    await reader.cancel();
  }
}

describe('shared assistant release boundary on disposable CouchDB', () => {
  it('uses rotated credentials, preserves retry identity across /new, and isolates browser accounts', async () => {
    const test = await fixture(false);
    const foreign = await fixture(false);
    test.options.client.tools = [
      { name: 'createTodo', description: 'Create todo', inputSchema: { type: 'object' } },
    ];
    test.options.client.invoke = vi.fn().mockResolvedValue([{ type: 'text', text: 'Created' }]);
    test.provider.setResponses([
      async () => {
        const user = await test.owner.registry.findByUsername(test.username);
        await test.owner.registry.update(test.owner.user._id, {
          preferences: { ...user!.preferences, mcpApiKey: 'rotated-key' },
        });
        return fauxAssistantMessage(fauxToolCall('createTodo', {}), { stopReason: 'toolUse' });
      },
      fauxAssistantMessage('Created with rotated credentials'),
    ]);
    await test.start();
    const id = randomUUID();
    const requestId = `web:${test.username}:${id}`;
    const init = {
      method: 'POST',
      headers: test.headers,
      body: JSON.stringify({ requestId: id, text: 'Create task once' }),
    };
    expect((await test.app.request('/api/assistant/messages', init)).status).toBe(202);
    await vi.waitFor(async () =>
      expect((await test.current().getRequestStatus(requestId))?.status).toBe('completed'),
    );
    expect(test.options.client.invoke).toHaveBeenCalledExactlyOnceWith(
      'createTodo',
      {},
      {
        username: test.username,
        mcpApiKey: 'rotated-key',
        operationId: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    );
    const original = await history(test);
    const oldPage = await test.app.request('/api/assistant/conversation?limit=1', {
      headers: test.headers,
    });
    const page = (await oldPage.json()) as AssistantHistoryPage;
    expect(page.nextCursor).not.toBeNull();
    const next = await test.history.startNewConversation();
    expect((await history(test)).messages).toEqual([]);
    const retry = await test.app.request('/api/assistant/messages', init);
    expect(await retry.json()).toMatchObject({
      conversationId: test.conversationId,
      status: 'completed',
    });
    expect(next._id).not.toBe(test.conversationId);
    expect(test.provider.state.callCount).toBe(2);
    expect(
      (
        await test.app.request(`/api/assistant/conversation?cursor=${page.nextCursor}`, {
          headers: test.headers,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await test.app.request(`/api/assistant/requests/${encodeURIComponent(requestId)}`, {
          headers: foreign.headers,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await test.app.request(`/api/assistant/stream?cursor=${original.changeCursor}`, {
          headers: foreign.headers,
        })
      ).status,
    ).toBe(400);
    expect(test.options.send).not.toHaveBeenCalled();
  });
  it('shares Telegram/web/report context, recovers projection without repeating mutation, and replays missed updates', async () => {
    const test = await fixture();
    modelResponses(test);
    await test.start();
    await test.current().execute(telegram(test, 'telegram:initial'));
    const checkpoint = (await history(test)).changeCursor;
    const requestId = await admitInterruptedWeb(test);
    await test.stop();
    const resumedAt = Date.now() + 31_000;
    vi.spyOn(Date, 'now').mockReturnValue(resumedAt);
    await test.start();
    await vi.waitFor(async () =>
      expect((await test.current().getRequestStatus(requestId))?.status).toBe('completed'),
    );
    expect(test.options.client.invoke).toHaveBeenCalledOnce();
    expect(test.options.send).toHaveBeenCalledOnce();
    expect((await history(test)).messages).toHaveLength(4);
    await test.current().execute(telegram(test, 'telegram:followup', 'What did web create?'));
    const report = telegram(test, 'report:briefing:release');
    report.report = { type: 'briefing', occurrence: '2026-10-30' };
    expect(await test.current().execute(report)).toContain('Alpha report');
    expect(test.options.print).toHaveBeenCalledOnce();
    expect(test.options.send).toHaveBeenCalledTimes(3);
    expect(test.provider.state.callCount).toBe(5);
    expect(new Set((await history(test)).messages.map((message) => message._id)).size).toBe(8);
    await streamReplay(test, checkpoint);
  });

  it('rejects revoked web-only credentials before mutation and blocks browser reads without replay', async () => {
    const test = await fixture(false);
    test.options.client.tools = [
      { name: 'createTodo', description: 'Create todo', inputSchema: { type: 'object' } },
    ];
    test.options.client.invoke = vi.fn();
    test.provider.setResponses([
      async () => {
        await test.owner.registry.update(test.owner.user._id, { status: 'suspended' });
        return fauxAssistantMessage(fauxToolCall('createTodo', {}), { stopReason: 'toolUse' });
      },
      fauxAssistantMessage('Access revoked'),
    ]);
    await test.start();
    const id = randomUUID();
    const requestId = `web:${test.username}:${id}`;
    const response = await test.app.request('/api/assistant/messages', {
      method: 'POST',
      headers: test.headers,
      body: JSON.stringify({ requestId: id, text: 'Create task' }),
    });
    expect(response.status).toBe(202);
    await vi.waitFor(async () =>
      expect((await test.current().getRequestStatus(requestId))?.status).toBe('failed'),
    );
    expect(test.options.client.invoke).not.toHaveBeenCalled();
    expect(test.options.send).not.toHaveBeenCalled();
    expect(
      (await test.app.request('/api/assistant/conversation', { headers: test.headers })).status,
    ).toBe(403);
    expect(
      (await test.app.request('/api/assistant/requests', { headers: test.headers })).status,
    ).toBe(403);
    await test.owner.registry.update(test.owner.user._id, { status: 'active' });
    const replay = await test.app.request('/api/assistant/messages', {
      method: 'POST',
      headers: test.headers,
      body: JSON.stringify({ requestId: id, text: 'Create task' }),
    });
    expect(((await replay.json()) as AssistantRequestStatus).status).toBe('failed');
    expect(test.options.client.invoke).not.toHaveBeenCalled();
  });
});
