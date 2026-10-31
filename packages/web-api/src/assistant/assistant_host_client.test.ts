// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createAssistantHostClient } from './assistant_host_client';
import { durableRequestId, receipt, submissionId } from './assistant_test_helpers';

const token = 'server-only-assistant-secret-at-least-32-characters';

describe('assistant loopback client', () => {
  it('uses only server credentials and explicitly binds account identity', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(receipt));
    const client = createAssistantHostClient({ port: 3003, token, fetch: transport });
    expect(await client.admit('alice', { requestId: submissionId, text: 'Hello' })).toEqual(
      receipt,
    );
    const [url, options] = transport.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3003/internal/assistant/admit');
    expect(options?.redirect).toBe('error');
    expect(options?.headers).toEqual({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      username: 'alice',
      requestId: submissionId,
      text: 'Hello',
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [401, 503],
    [500, 503],
    [403, 403],
    [409, 409],
    [413, 413],
  ])(
    'maps host %i to public %i without forwarding diagnostics',
    async (hostStatus, publicStatus) => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ secret: 'backend diagnostics' }, { status: hostStatus }),
        );
      const client = createAssistantHostClient({ port: 3003, token, fetch: transport });
      await expect(
        client.admit('alice', { requestId: submissionId, text: 'Hello' }),
      ).rejects.toMatchObject({ status: publicStatus });
    },
  );

  it('does not call the host without configuration and does not retry ambiguous admission', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('Network interrupted after admission'));
    const missing = createAssistantHostClient({ port: 3003, fetch: transport });
    await expect(missing.status('alice', durableRequestId)).rejects.toMatchObject({ status: 503 });
    expect(transport).not.toHaveBeenCalled();
    const client = createAssistantHostClient({ port: 3003, token, fetch: transport });
    await expect(
      client.admit('alice', { requestId: submissionId, text: 'Hello' }),
    ).rejects.toMatchObject({ status: 503 });
    expect(transport).toHaveBeenCalledOnce();
  });

  it('rejects foreign receipts and oversized responses', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ ...receipt, requestId: 'web:bob:1' }))
      .mockResolvedValueOnce(new Response('x'.repeat(4097)));
    const client = createAssistantHostClient({ port: 3003, token, fetch: transport });
    await expect(client.status('alice', durableRequestId)).rejects.toMatchObject({ status: 503 });
    await expect(client.status('alice', durableRequestId)).rejects.toMatchObject({ status: 503 });
  });

  it('propagates disconnection only to read-only status polling', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(receipt));
    const client = createAssistantHostClient({ port: 3003, token, fetch: transport });
    const controller = new AbortController();
    await client.status('alice', durableRequestId, controller.signal);
    controller.abort();
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it('returns unknown persisted request status without admitting replacement work', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }));
    expect(
      await createAssistantHostClient({ port: 3003, token, fetch: transport }).status(
        'alice',
        durableRequestId,
      ),
    ).toBeNull();
    expect(transport).toHaveBeenCalledOnce();
  });
});
