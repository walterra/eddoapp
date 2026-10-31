// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createAssistantHostClient } from './assistant_host_client';

const token = 'test-internal-assistant-token-123456789';
const page = {
  requests: [{ requestId: 'telegram:bot:1', conversationId: 'active', status: 'working' }],
  hasMore: false,
};

describe('account pending discovery transport', () => {
  it('returns bounded cross-channel statuses using service credentials and read-only cancellation', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(page));
    const client = createAssistantHostClient({ port: 3003, token, fetch: transport });
    const signal = new AbortController().signal;
    expect(await client.pending('alice', signal)).toEqual(page);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3003/internal/assistant/pending');
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${token}` });
    expect(JSON.parse(String(init?.body))).toEqual({ username: 'alice' });
  });

  it('rejects cross-account receipts and oversized discovery batches', async () => {
    const foreign = { ...page, requests: [{ ...page.requests[0], requestId: 'web:bob:1' }] };
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(foreign))
      .mockResolvedValueOnce(
        Response.json({
          requests: Array.from({ length: 101 }, () => page.requests[0]),
          hasMore: true,
        }),
      );
    const client = createAssistantHostClient({ port: 3003, token, fetch: transport });
    await expect(client.pending('alice')).rejects.toMatchObject({
      status: 503,
      code: 'unavailable',
    });
    await expect(client.pending('alice')).rejects.toMatchObject({
      status: 503,
      code: 'unavailable',
    });
  });

  it('preserves revocation without exposing infrastructure failures', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: 'private registry error' }, { status: 403 }))
      .mockRejectedValueOnce(new Error('secret transport diagnostic'));
    const client = createAssistantHostClient({ port: 3003, token, fetch: transport });
    await expect(client.pending('alice')).rejects.toMatchObject({
      status: 403,
      message: 'forbidden',
    });
    await expect(client.pending('alice')).rejects.toMatchObject({
      status: 503,
      message: 'unavailable',
    });
  });
});
