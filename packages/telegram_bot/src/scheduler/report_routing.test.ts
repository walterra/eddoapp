import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelegramUser } from '../utils/user-lookup.js';
import { runScheduledReport, scheduledReportPrompt } from './report_routing.js';

const mocks = vi.hoisted(() => ({ enqueue: vi.fn(), reserved: vi.fn() }));
vi.mock('../durable/host.js', () => ({ enqueueDurableReport: mocks.enqueue }));
vi.mock('./report-reservation.js', () => ({ hasReportReservation: mocks.reserved }));
const user = {
  username: 'alice',
  telegram_id: 123,
  database_name: 'eddo_user_alice',
  preferences: { timezone: 'Europe/Vienna' },
} as TelegramUser;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reserved.mockResolvedValue(false);
  mocks.enqueue.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe('unconditional durable report routing', () => {
  it.each(['briefing', 'recap'] as const)(
    'admits every %s into Durable with the stable occurrence key',
    async (type) => {
      const sentKey = 'user_alice:2026-10-20:07:00';
      expect(await runScheduledReport({ user, type, sentKey })).toBe(true);
      expect(mocks.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'alice', type, occurrence: sentKey }),
      );
    },
  );
  it('honors an existing pre-migration reservation without regenerating that occurrence', async () => {
    mocks.reserved.mockResolvedValue(true);
    expect(await runScheduledReport({ user, type: 'briefing', sentKey: 'today' })).toBe(false);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('propagates admission failures without another execution path', async () => {
    mocks.enqueue.mockRejectedValueOnce(new Error('storage failure'));
    await expect(runScheduledReport({ user, type: 'recap', sentKey: 'today' })).rejects.toThrow(
      'storage failure',
    );
    expect(mocks.enqueue).toHaveBeenCalledOnce();
  });
  it('expires reports at local midnight across a DST transition', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T06:00:00Z'));
    await runScheduledReport({ user, type: 'recap', sentKey: 'user_alice:2026-10-25:18:00' });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ deadline: Date.parse('2026-10-25T22:59:59.999Z') }),
    );
  });
  it('asks for discussion context and fresh database evidence without mutations', () => {
    const prompt = scheduledReportPrompt('briefing');
    expect(prompt).toContain('Use our conversation');
    expect(prompt).toContain('Fetch current todo/time-tracking data');
    expect(prompt).toContain('Do not create, update, delete');
    expect(prompt).toContain('getBriefingData');
  });
});
