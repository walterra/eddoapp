// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createInternalAssistantHandler } from './internal_handler.js';
import { InternalAssistantError, MAX_INTERNAL_BODY_BYTES } from './internal_protocol.js';

const token = 'test-internal-assistant-token-123456789';
const input = {
  username: 'alice',
  requestId: '70f72756-993e-4cae-8108-f6b723391ae1',
  text: 'List tasks',
};

function fixture() {
  const status = {
    requestId: `web:alice:${input.requestId}`,
    conversationId: 'active',
    status: 'queued' as const,
  };
  const options = {
    token,
    admit: vi.fn().mockResolvedValue(status),
    status: vi.fn().mockResolvedValue(status),
  };
  return { options, handler: createInternalAssistantHandler(options), status };
}

function request(path = 'admit', body: unknown = input, secret = token): Request {
  return new Request(`http://localhost/internal/assistant/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('internal assistant transport', () => {
  it.each(['', 'wrong-token'])(
    'rejects unauthorized requests before admission: %s',
    async (secret) => {
      const test = fixture();
      expect((await test.handler(request('admit', input, secret))).status).toBe(401);
      expect(test.options.admit).not.toHaveBeenCalled();
    },
  );

  it('admits bounded requests and exposes only durable status with no cache or CORS access', async () => {
    const test = fixture();
    const response = await test.handler(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(test.status);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(test.options.admit).toHaveBeenCalledExactlyOnceWith(input);
  });

  it.each([
    { ...input, conversationId: 'foreign' },
    { ...input, source: { channel: 'telegram' } },
    { ...input, requestId: 'not-a-uuid' },
    { ...input, text: 'x'.repeat(8_001) },
  ])('rejects client-controlled routing and invalid inputs', async (invalid) => {
    const test = fixture();
    expect((await test.handler(request('admit', invalid))).status).toBe(400);
    expect(test.options.admit).not.toHaveBeenCalled();
  });

  it('bounds actual bodies without trusting Content-Length', async () => {
    const test = fixture();
    const oversized = new Request('http://localhost/internal/assistant/admit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: 'x'.repeat(MAX_INTERNAL_BODY_BYTES + 1),
    });
    expect((await test.handler(oversized)).status).toBe(413);
    expect(test.options.admit).not.toHaveBeenCalled();
  });

  it('returns missing status without admitting another request', async () => {
    const test = fixture();
    test.options.status.mockResolvedValue(null);
    expect(
      (
        await test.handler(
          request('status', { username: 'alice', requestId: test.status.requestId }),
        )
      ).status,
    ).toBe(404);
    expect(test.options.admit).not.toHaveBeenCalled();
  });

  it.each([new Error('secret provider diagnostics'), new TypeError('private transport failure')])(
    'sanitizes backend failures',
    async (error) => {
      const test = fixture();
      test.options.admit.mockRejectedValue(error);
      const response = await test.handler(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'unavailable' });
    },
  );

  it('returns explicit conflict and authorization statuses without diagnostics', async () => {
    const test = fixture();
    test.options.admit.mockRejectedValue(new InternalAssistantError(409, 'request_conflict'));
    expect((await test.handler(request())).status).toBe(409);
    test.options.admit.mockRejectedValue(new InternalAssistantError(403, 'forbidden'));
    expect((await test.handler(request())).status).toBe(403);
  });

  it('rejects weak configuration and unsupported routes or methods', async () => {
    const test = fixture();
    expect(() => createInternalAssistantHandler({ ...test.options, token: 'short' })).toThrow('32');
    expect((await test.handler(request('unknown'))).status).toBe(404);
    expect(
      (
        await test.handler(
          new Request('http://localhost/internal/assistant/admit', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        )
      ).status,
    ).toBe(405);
  });
});
