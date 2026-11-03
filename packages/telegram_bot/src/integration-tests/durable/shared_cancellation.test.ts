import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { Harness } from '@earendil-works/pi-durable';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sharedAssistantFixture, type SharedAssistantFixture } from './shared_assistant_fixture.js';

const fixtures: SharedAssistantFixture[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(fixtures.splice(0).map((test) => test.cleanup()));
});
async function fixture(): Promise<SharedAssistantFixture> {
  const test = await sharedAssistantFixture(false);
  fixtures.push(test);
  return test;
}
function cancelPath(username: string, id: string): string {
  return `/api/assistant/requests/${encodeURIComponent(`web:${username}:${id}`)}/cancel`;
}

describe('shared cancellation through real JWT, owner transport, and CouchDB', () => {
  it('persists an unconfirmed cancellation across restart and rejects late admission without generation', async () => {
    const test = await fixture();
    await test.start();
    const id = randomUUID();
    const path = cancelPath(test.username, id);
    const response = await test.app.request(path, { method: 'POST', headers: test.headers });
    expect(response.status).toBe(200);
    const expected = {
      requestId: `web:${test.username}:${id}`,
      conversationId: test.conversationId,
      status: 'aborted',
    };
    expect(await response.json()).toEqual(expected);
    await test.stop();
    await test.start();
    const late = await test.app.request('/api/assistant/messages', {
      method: 'POST',
      headers: test.headers,
      body: JSON.stringify({ requestId: id, text: 'Never execute this message' }),
    });
    expect(late.status).toBe(202);
    expect(await late.json()).toEqual(expected);
    const duplicate = await test.app.request(path, { method: 'POST', headers: test.headers });
    expect(await duplicate.json()).toEqual(expected);
    expect(test.provider.state.callCount).toBe(0);
    expect(test.options.client.invoke).not.toHaveBeenCalled();
    expect(test.options.send).not.toHaveBeenCalled();
    expect(await test.current().getPendingRequests()).toEqual({ requests: [], hasMore: false });
  });

  it('waits for an in-flight tool and prevents later tool calls and reply delivery', async () => {
    const test = await fixture();
    test.options.client.tools = ['getTodo', 'createTodo'].map((name) => ({
      name,
      description: name,
      inputSchema: { type: 'object' },
    }));
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    test.options.client.invoke = vi.fn().mockImplementation(async () => {
      await gate;
      return [{ type: 'text', text: 'Already-started tool finished' }];
    });
    test.provider.setResponses([
      fauxAssistantMessage([fauxToolCall('getTodo', {}), fauxToolCall('createTodo', {})], {
        stopReason: 'toolUse',
      }),
    ]);
    let harness: Harness | undefined;
    const original = Harness.open.bind(Harness);
    const opening = vi.spyOn(Harness, 'open').mockImplementation(async (...args) => {
      harness = await original(...args);
      return harness;
    });
    await test.start();
    opening.mockRestore();
    const id = randomUUID();
    await test.app.request('/api/assistant/messages', {
      method: 'POST',
      headers: test.headers,
      body: JSON.stringify({ requestId: id, text: 'Run tools' }),
    });
    await vi.waitFor(() => expect(test.options.client.invoke).toHaveBeenCalledOnce());
    let confirmed = false;
    const cancellation = Promise.resolve(
      test.app.request(cancelPath(test.username, id), {
        method: 'POST',
        headers: test.headers,
      }),
    ).then((response) => {
      confirmed = true;
      return response;
    });
    try {
      await vi.waitFor(async () =>
        expect(
          (await harness!.inspect(BACKGROUND_CONTEXT)).tasks.some(
            ({ record }) => record.kind === 'pi.tool' && record.abortRequested,
          ),
        ).toBe(true),
      );
      expect(confirmed).toBe(false);
    } finally {
      release();
    }
    const response = await cancellation;
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'aborted' });
    expect(test.options.client.invoke).toHaveBeenCalledOnce();
    expect(vi.mocked(test.options.client.invoke).mock.calls[0][0]).toBe('getTodo');
    expect(test.provider.state.callCount).toBe(1);
    expect(test.options.project).not.toHaveBeenCalled();
    expect(test.options.send).not.toHaveBeenCalled();
  });
});
