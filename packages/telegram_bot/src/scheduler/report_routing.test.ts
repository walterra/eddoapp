import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelegramUser } from '../utils/user-lookup.js';
import { runScheduledReport, scheduledReportPrompt } from './report_routing.js';

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  reserved: vi.fn(),
  reserve: vi.fn(),
  legacy: vi.fn(),
}));
vi.mock('../durable/host.js', () => ({ enqueueDurableReport: mocks.enqueue }));
vi.mock('./report-reservation.js', () => ({
  hasReportReservation: mocks.reserved,
  reserveReport: mocks.reserve,
  runReservedReport: mocks.legacy,
}));

const user = {
  username: 'alice',
  telegram_id: 123,
  database_name: 'eddo_user_alice',
  preferences: { timezone: 'Europe/Vienna' },
} as TelegramUser;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TELEGRAM_DURABLE_USERS', 'alice');
  mocks.reserved.mockResolvedValue(false);
  mocks.reserve.mockResolvedValue(null);
  mocks.enqueue.mockResolvedValue(undefined);
  mocks.legacy.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('scheduled report routing', () => {
  it.each(['briefing', 'recap'] as const)(
    'admits %s before writing a legacy compatibility receipt',
    async (type) => {
      const legacy = vi.fn();
      const sentKey = 'user_alice:2026-10-20:07:00';
      expect(await runScheduledReport({ user, type, sentKey }, legacy)).toBe(true);
      expect(mocks.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'alice', type, occurrence: sentKey }),
      );
      expect(mocks.reserve).toHaveBeenCalledWith(user.database_name, `${type}:${sentKey}`);
      expect(mocks.enqueue.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.reserve.mock.invocationCallOrder[0],
      );
      expect(legacy).not.toHaveBeenCalled();
      expect(mocks.legacy).not.toHaveBeenCalled();
    },
  );

  it('honors an existing legacy reservation during migration', async () => {
    mocks.reserved.mockResolvedValue(true);
    expect(await runScheduledReport({ user, type: 'briefing', sentKey: 'today' }, vi.fn())).toBe(
      false,
    );
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('does not reserve or fall back if durable admission fails', async () => {
    mocks.enqueue.mockRejectedValueOnce(new Error('storage failure'));
    const legacy = vi.fn();
    await expect(
      runScheduledReport({ user, type: 'recap', sentKey: 'today' }, legacy),
    ).rejects.toThrow('storage failure');
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(legacy).not.toHaveBeenCalled();
  });

  it('preserves the legacy reservation/delivery path for other users', async () => {
    vi.stubEnv('TELEGRAM_DURABLE_USERS', 'bob');
    const legacy = vi.fn();
    await runScheduledReport({ user, type: 'briefing', sentKey: 'today' }, legacy);
    expect(mocks.legacy).toHaveBeenCalledWith(user.database_name, 'briefing:today', legacy);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('expires reports at local midnight across a DST transition', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T06:00:00Z'));
    await runScheduledReport(
      { user, type: 'recap', sentKey: 'user_alice:2026-10-25:18:00' },
      vi.fn(),
    );
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
