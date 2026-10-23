import { describe, expect, it } from 'vitest';
import { deliveryDeadline, deliveryRetry } from './delivery_policy.js';
import { createTestInput } from './test_helpers.js';

describe('Telegram delivery policy', () => {
  it.each([400, 401, 403, 404])('stops permanent HTTP %s failures', (error_code) => {
    expect(deliveryRetry({ error_code }, 1, 100_000, 0).failure).toContain('permanently');
  });

  it.each([new Error('Network failure'), { error_code: 500 }, { error_code: 503 }])(
    'retries transient failures at most five times',
    (error) => {
      expect(deliveryRetry(error, 1, 100_000, 0)).toEqual({ retryAt: 30_000 });
      expect(deliveryRetry(error, 5, 100_000, 0).failure).toContain('limit');
    },
  );

  it('honors Telegram retry_after without crossing expiry', () => {
    const error = { error_code: 429, parameters: { retry_after: 60 } };
    expect(deliveryRetry(error, 1, 100_000, 0)).toEqual({ retryAt: 60_000 });
    expect(deliveryRetry(error, 1, 60_000, 0).failure).toContain('expired');
  });

  it('bounds scheduled delivery by occurrence expiry and allows interactive recovery grace', () => {
    expect(deliveryDeadline(createTestInput({ deadline: 1000 }))).toBe(3_601_000);
    expect(
      deliveryDeadline(
        createTestInput({
          deadline: 1000,
          report: { type: 'briefing', occurrence: 'today' },
        }),
      ),
    ).toBe(1000);
  });
});
