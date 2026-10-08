import { afterEach, describe, expect, it } from 'vitest';
import { browserTelemetryHeaders } from './headers';

afterEach(() => localStorage.removeItem('authToken'));

describe('browser telemetry authentication', () => {
  it('reads refreshed JWTs at export time', async () => {
    localStorage.setItem('authToken', JSON.stringify({ token: 'first' }));
    expect(await browserTelemetryHeaders()).toEqual({ Authorization: 'Bearer first' });
    localStorage.setItem('authToken', JSON.stringify({ token: 'second' }));
    expect(await browserTelemetryHeaders()).toEqual({ Authorization: 'Bearer second' });
  });
  it.each(['null', 'invalid JSON', '42', '{"token":42}'])(
    'does not authorize invalid sessions',
    async (value) => {
      localStorage.setItem('authToken', value);
      expect(await browserTelemetryHeaders()).toEqual({});
    },
  );
});
