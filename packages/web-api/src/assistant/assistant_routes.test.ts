// @vitest-environment node
import { Hono } from 'hono';
import { jwt, sign } from 'hono/jwt';
import { describe, expect, it, vi } from 'vitest';
import { assistantHttpBoundary } from './assistant_access';
import { changeCursor } from './assistant_cursors';
import { AssistantApiError } from './assistant_errors';
import { createAssistantRoutes } from './assistant_routes';
import {
  assistantServiceFixture,
  durableRequestId,
  emptyHistory,
  receipt,
  submissionId,
} from './assistant_test_helpers';

const secret = 'assistant-route-test-jwt-secret-at-least-32-characters';
async function fixture() {
  const service = assistantServiceFixture();
  const app = new Hono();
  app.use('/api/assistant/*', assistantHttpBoundary());
  app.use('/api/assistant/*', jwt({ secret, alg: 'HS256' }));
  app.route('/api/assistant', createAssistantRoutes(service));
  const token = await sign(
    { username: 'alice', exp: Math.floor(Date.now() / 1000) + 3600 },
    secret,
    'HS256',
  );
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  return { service, app, headers };
}

describe('authenticated assistant routes', () => {
  it('discovers pending work only for the JWT account without admitting requests', async () => {
    const test = await fixture();
    const page = { requests: [receipt], hasMore: false };
    vi.mocked(test.service.host.pending).mockResolvedValue(page);
    const response = await test.app.request('/api/assistant/requests', { headers: test.headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(test.service.host.pending).toHaveBeenCalledWith('alice', expect.any(AbortSignal));
    expect(test.service.host.admit).not.toHaveBeenCalled();
  });
  it('rejects missing JWTs and query-token authentication', async () => {
    const test = await fixture();
    const missing = await test.app.request('/api/assistant/conversation');
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: 'unauthorized' });
    expect(missing.headers.get('cache-control')).toBe('no-store');
    const invalid = await test.app.request('/api/assistant/conversation', {
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual({ error: 'unauthorized' });
    expect(
      (
        await test.app.request('/api/assistant/conversation?token=secret', {
          headers: test.headers,
        })
      ).status,
    ).toBe(401);
    const nonExpiring = await sign({ username: 'alice' }, secret, 'HS256');
    expect(
      (
        await test.app.request('/api/assistant/conversation', {
          headers: { Authorization: `Bearer ${nonExpiring}` },
        })
      ).status,
    ).toBe(401);
    expect(test.service.store.history).not.toHaveBeenCalled();
  });

  it('reads paginated history only for the verified account', async () => {
    const test = await fixture();
    const response = await test.app.request('/api/assistant/conversation?limit=20', {
      headers: test.headers,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(emptyHistory);
    expect(test.service.store.history).toHaveBeenCalledExactlyOnceWith('alice', { limit: 20 });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(
      (
        await test.app.request('/api/assistant/conversation?username=bob', {
          headers: test.headers,
        })
      ).status,
    ).toBe(400);
  });

  it('admits messages with stable UUIDs without passing browser-selected identity or routing', async () => {
    const test = await fixture();
    const response = await test.app.request('/api/assistant/messages', {
      method: 'POST',
      headers: test.headers,
      body: JSON.stringify({ requestId: submissionId, text: 'List tasks' }),
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(receipt);
    expect(test.service.host.admit).toHaveBeenCalledExactlyOnceWith('alice', {
      requestId: submissionId,
      text: 'List tasks',
    });
    const invalid = await test.app.request('/api/assistant/messages', {
      method: 'POST',
      headers: test.headers,
      body: JSON.stringify({
        requestId: submissionId,
        text: 'List tasks',
        username: 'bob',
        conversationId: 'foreign',
      }),
    });
    expect(invalid.status).toBe(400);
    expect(test.service.host.admit).toHaveBeenCalledOnce();
  });

  it('enforces message-body limits and maps conflicts without leaking backend details', async () => {
    const test = await fixture();
    expect(
      (
        await test.app.request('/api/assistant/messages', {
          method: 'POST',
          headers: test.headers,
          body: 'x'.repeat(32769),
        })
      ).status,
    ).toBe(413);
    vi.mocked(test.service.host.admit).mockRejectedValue(
      new AssistantApiError(409, 'request_conflict'),
    );
    const response = await test.app.request('/api/assistant/messages', {
      method: 'POST',
      headers: test.headers,
      body: JSON.stringify({ requestId: submissionId, text: 'Hello' }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'request_conflict' });
  });

  it('rejects cross-account status IDs before contacting the host', async () => {
    const test = await fixture();
    expect(
      (
        await test.app.request(`/api/assistant/requests/web:bob:${submissionId}`, {
          headers: test.headers,
        })
      ).status,
    ).toBe(403);
    expect(test.service.host.status).not.toHaveBeenCalled();
    expect(
      (
        await test.app.request(`/api/assistant/requests/${durableRequestId}`, {
          headers: test.headers,
        })
      ).status,
    ).toBe(200);
    expect(test.service.host.status).toHaveBeenCalledExactlyOnceWith('alice', durableRequestId);
  });

  it('rejects revoked accounts and sanitizes infrastructure failures', async () => {
    const test = await fixture();
    vi.mocked(test.service.authorize).mockRejectedValueOnce(
      new AssistantApiError(403, 'forbidden'),
    );
    expect(
      (await test.app.request('/api/assistant/conversation', { headers: test.headers })).status,
    ).toBe(403);
    vi.mocked(test.service.store.history).mockRejectedValue(
      new Error('CouchDB password or provider diagnostics'),
    );
    const response = await test.app.request('/api/assistant/conversation', {
      headers: test.headers,
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });

  it('enforces rate limits before repeated admission', async () => {
    const test = await fixture();
    for (let index = 0; index < 10; index += 1) {
      expect(
        (
          await test.app.request('/api/assistant/messages', {
            method: 'POST',
            headers: test.headers,
            body: JSON.stringify({ requestId: submissionId, text: 'Hello' }),
          })
        ).status,
      ).toBe(202);
    }
    const response = await test.app.request('/api/assistant/messages', {
      method: 'POST',
      headers: test.headers,
      body: JSON.stringify({ requestId: submissionId, text: 'Hello' }),
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(test.service.host.admit).toHaveBeenCalledTimes(10);
  });

  it('rejects foreign reconnect cursors and bounds active streams until disconnect', async () => {
    const test = await fixture();
    expect(
      (
        await test.app.request(`/api/assistant/stream?cursor=${changeCursor('bob', '12')}`, {
          headers: test.headers,
        })
      ).status,
    ).toBe(400);
    const first = await test.app.request('/api/assistant/stream', { headers: test.headers });
    const second = await test.app.request('/api/assistant/stream', { headers: test.headers });
    expect(first.status).toBe(200);
    expect(
      (await test.app.request('/api/assistant/stream', { headers: test.headers })).status,
    ).toBe(429);
    await first.body?.cancel();
    await second.body?.cancel();
    const replacement = await test.app.request('/api/assistant/stream', { headers: test.headers });
    expect(replacement.status).toBe(200);
    await replacement.body?.cancel();
  });
});
