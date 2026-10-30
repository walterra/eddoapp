// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createAssistantBrowserClient } from './assistant_api';
import { historyPage, projectionIds, submissionId } from './assistant_test_helpers';
import type { AssistantPendingRequest } from './assistant_types';

const pending: AssistantPendingRequest = {
  username: 'alice',
  submissionId,
  text: 'Hello',
  createdAt: '2026-10-29T00:00:00.000Z',
  conversationId: 'active',
  projectionIds,
};
const receipt = {
  requestId: `web:alice:${submissionId}`,
  conversationId: 'active',
  status: 'queued',
};

describe('assistant browser transport', () => {
  it('sends only the stable submission UUID and text using header-only browser authentication', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(receipt));
    await createAssistantBrowserClient({
      username: 'alice',
      token: 'browser-jwt',
      fetch: transport,
    }).admit(pending);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe('/api/assistant/messages');
    expect(JSON.parse(String(init?.body))).toEqual({ requestId: submissionId, text: 'Hello' });
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer browser-jwt' });
    expect(init?.signal?.aborted).toBe(false);
    expect(String(url)).not.toContain('browser-jwt');
  });

  it('resumes SSE through Last-Event-ID without putting JWTs in URLs', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('event: checkpoint\ndata: {"cursor":"next"}\nid: next\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    const client = createAssistantBrowserClient({
      username: 'alice',
      token: 'browser-jwt',
      fetch: transport,
    });
    const event = vi.fn();
    await client.stream({
      cursor: 'previous',
      requestIds: [receipt.requestId],
      signal: new AbortController().signal,
      onConnected: vi.fn(),
      onEvent: event,
    });
    expect(transport.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer browser-jwt',
      'Last-Event-ID': 'previous',
    });
    expect(String(transport.mock.calls[0][0])).not.toContain('browser-jwt');
    expect(event).toHaveBeenCalledWith({
      event: 'checkpoint',
      data: { cursor: 'next' },
      id: 'next',
    });
  });

  it('rejects foreign history or status receipts instead of rendering them', async () => {
    const foreign = historyPage('bob');
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(foreign))
      .mockResolvedValueOnce(Response.json({ ...receipt, requestId: 'web:bob:other' }));
    const client = createAssistantBrowserClient({
      username: 'alice',
      token: 'jwt',
      fetch: transport,
    });
    await expect(client.history()).rejects.toMatchObject({ code: 'protocol' });
    await expect(client.status(receipt.requestId)).rejects.toMatchObject({ code: 'protocol' });
  });

  it('honors server rate-limit delays without exposing backend error details', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: 'private diagnostic' },
          { status: 429, headers: { 'Retry-After': '60' } },
        ),
      );
    const client = createAssistantBrowserClient({
      username: 'alice',
      token: 'jwt',
      fetch: transport,
    });
    await expect(client.history()).rejects.toMatchObject({
      code: 'rate_limited',
      retryAfter: 60,
      message: 'rate_limited',
    });
  });
});
