import { describe, expect, it, vi } from 'vitest';
import { createTelemetryRoutes } from './telemetry';
import { buildTelemetryHeaders, parseOtlpHeaders } from './telemetry_headers';

vi.mock('../utils/logger', () => ({ logger: { warn: vi.fn() } }));

function fixture(endpoint = 'https://collector.invalid:4318/') {
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response('{"partialSuccess":{}}', { status: 200 }),
  );
  const app = createTelemetryRoutes({
    fetch,
    getConfig: () => ({
      OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
      OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Bearer%20synthetic-token',
    }),
  });
  return { app, fetch };
}

describe('OTLP proxy', () => {
  it.each(['traces', 'metrics', 'logs'])(
    'forwards %s with server-side bearer authentication',
    async (signal) => {
      const { app, fetch } = fixture();
      const response = await app.request(`/v1/${signal}`, {
        method: 'POST',
        body: '{"resource":[]}',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer browser-jwt',
          Cookie: 'private-cookie',
        },
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('{"partialSuccess":{}}');
      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe(`https://collector.invalid:4318/v1/${signal}`);
      const headers = new Headers(options?.headers);
      expect(headers.get('Authorization')).toBe('Bearer synthetic-token');
      expect(headers.has('Cookie')).toBe(false);
      expect(options?.redirect).toBe('error');
    },
  );
  it('preserves protobuf bytes without UTF-8 conversion', async () => {
    const { app, fetch } = fixture();
    const bytes = new Uint8Array([0, 255, 128, 10, 195]);
    await app.request('/v1/traces', {
      method: 'POST',
      body: bytes.buffer,
      headers: { 'Content-Type': 'application/x-protobuf' },
    });
    expect(new Uint8Array(fetch.mock.calls[0][1]?.body as ArrayBuffer)).toEqual(bytes);
  });
  it('retains disabled-default behavior', async () => {
    const { app, fetch } = fixture('http://localhost:4318');
    expect((await app.request('/v1/traces', { method: 'POST' })).status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects unsupported bodies and bounds request size', async () => {
    const { app, fetch } = fixture();
    expect((await app.request('/v1/logs', { method: 'POST', body: 'text' })).status).toBe(415);
    expect(
      (
        await app.request('/v1/logs', {
          method: 'POST',
          body: 'x'.repeat(1024 * 1024 + 1),
          headers: { 'Content-Type': 'application/json' },
        })
      ).status,
    ).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not reflect exporter errors or secrets', async () => {
    const { app, fetch } = fixture();
    fetch.mockRejectedValue(new Error('synthetic-token'));
    const response = await app.request('/v1/traces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('synthetic-token');
  });
  it.each(['https://user:secret@collector.invalid', 'https://collector.invalid/v1/traces'])(
    'rejects ambiguous endpoints',
    async (endpoint) => {
      const { app, fetch } = fixture(endpoint);
      expect((await app.request('/v1/traces', { method: 'POST' })).status).toBe(502);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe('OTLP authentication headers', () => {
  it('preserves encoded equals signs and uses legacy keys only as fallback', () => {
    expect(parseOtlpHeaders('Authorization=Bearer%20abc%3D%3D').get('Authorization')).toBe(
      'Bearer abc==',
    );
    expect(
      buildTelemetryHeaders({ OTEL_API_KEY: 'legacy' }, 'application/json').get('Authorization'),
    ).toBe('ApiKey legacy');
    expect(
      buildTelemetryHeaders(
        { OTEL_API_KEY: 'legacy', OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Bearer%20new' },
        'application/json',
      ).get('Authorization'),
    ).toBe('Bearer new');
  });
  it.each(['invalid', 'Authorization=%ZZ', 'Authorization=Bearer%0Dsecret', 'a=1,a=2'])(
    'rejects malformed headers without secrets',
    (header) => {
      expect(() => parseOtlpHeaders(header)).toThrow('Invalid OTLP header configuration');
    },
  );
});
