import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasReportReservation } from './report-reservation.js';

const get = vi.hoisted(() => vi.fn());
vi.mock('@eddo/core-server', () => ({ createEnv: () => ({ COUCHDB_URL: 'http://unused' }) }));
vi.mock('nano', () => ({ default: () => ({ db: { use: () => ({ get }) } }) }));

beforeEach(() => {
  get.mockReset();
});

describe('legacy report compatibility receipts', () => {
  it('reads the existing reservation identity without writing a new lock', async () => {
    get.mockResolvedValue({ _rev: '1' });
    expect(await hasReportReservation('user_db', 'briefing:today')).toBe(true);
    expect(get).toHaveBeenCalledWith(
      `_local/scheduled-report-${createHash('sha256').update('briefing:today').digest('hex')}`,
    );
  });

  it('permits admission only when the reservation is absent', async () => {
    get.mockRejectedValue({ statusCode: 404 });
    expect(await hasReportReservation('user_db', 'briefing:today')).toBe(false);
  });

  it('fails closed on an unavailable or unauthorized database', async () => {
    get.mockRejectedValue(new Error('database unavailable'));
    await expect(hasReportReservation('user_db', 'briefing:today')).rejects.toThrow(
      'database unavailable',
    );
  });
});
