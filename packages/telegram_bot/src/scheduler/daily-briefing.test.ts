import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelegramUser } from '../utils/user-lookup.js';
import { createDailyBriefingScheduler } from './daily-briefing.js';

const mocks = vi.hoisted(() => ({ list: vi.fn(), admit: vi.fn() }));
vi.mock('@eddo/core-server', () => ({
  createEnv: () => ({ COUCHDB_URL: 'http://unused' }),
  createUserRegistry: () => ({ list: mocks.list }),
  normalizeTimeZone: () => 'UTC',
  formatTimeInTimeZone: (date: Date) => date.toISOString().slice(11, 16),
  formatDateInTimeZone: (date: Date) => date.toISOString().slice(0, 10),
}));
vi.mock('./report_routing.js', () => ({ runScheduledReport: mocks.admit }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
  withSpan: async (_name: string, _attributes: unknown, action: () => Promise<boolean>) => action(),
}));

function user(type: string): TelegramUser {
  return {
    _id: 'user_test',
    username: 'test',
    telegram_id: 123,
    status: 'active',
    preferences: {
      dailyBriefing: type === 'briefing',
      dailyRecap: type === 'recap',
      briefingTime: '07:00',
      recapTime: '07:00',
      timezone: 'UTC',
    },
  } as TelegramUser;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T07:00:00Z'));
  vi.clearAllMocks();
  mocks.admit.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());

describe.each(['briefing', 'recap'])('%s durable scheduling', (type) => {
  beforeEach(() => {
    mocks.list.mockResolvedValue([user(type)]);
  });
  it('admits once per occurrence and does not own generation or delivery', async () => {
    const scheduler = createDailyBriefingScheduler({ checkIntervalMs: 60000 });
    await scheduler.checkNow();
    await scheduler.checkNow();
    expect(mocks.admit).toHaveBeenCalledExactlyOnceWith({
      user: user(type),
      type,
      sentKey: 'user_test:2026-10-20:07:00',
    });
  });
  it('uses the same occurrence key after scheduler restart for durable deduplication', async () => {
    await createDailyBriefingScheduler({ checkIntervalMs: 60000 }).checkNow();
    await createDailyBriefingScheduler({ checkIntervalMs: 60000 }).checkNow();
    expect(mocks.admit.mock.calls[0]).toEqual(mocks.admit.mock.calls[1]);
  });
  it('prevents overlapping checks in the same process', async () => {
    let finish!: (admitted: boolean) => void;
    mocks.admit.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const scheduler = createDailyBriefingScheduler({ checkIntervalMs: 60000 });
    const pending = scheduler.checkNow();
    await vi.waitFor(() => expect(mocks.admit).toHaveBeenCalledOnce());
    await scheduler.checkNow();
    expect(mocks.admit).toHaveBeenCalledOnce();
    finish(true);
    await pending;
  });
  it('retries failed admission without reserving or falling back to another agent', async () => {
    mocks.admit.mockRejectedValueOnce(new Error('storage unavailable'));
    const scheduler = createDailyBriefingScheduler({ checkIntervalMs: 60000 });
    await scheduler.checkNow();
    await scheduler.checkNow();
    expect(mocks.admit).toHaveBeenCalledTimes(2);
  });
  it('uses a new key the next local day and after schedule changes', async () => {
    const scheduler = createDailyBriefingScheduler({ checkIntervalMs: 60000 });
    await scheduler.checkNow();
    vi.setSystemTime(new Date('2026-10-21T07:00:00Z'));
    await scheduler.checkNow();
    expect(mocks.admit.mock.calls[1][0].sentKey).toBe('user_test:2026-10-21:07:00');
    const changed = user(type);
    changed.preferences.briefingTime = '07:01';
    changed.preferences.recapTime = '07:01';
    mocks.list.mockResolvedValue([changed]);
    vi.setSystemTime(new Date('2026-10-21T07:01:00Z'));
    await scheduler.checkNow();
    expect(mocks.admit.mock.calls[2][0].sentKey).toBe('user_test:2026-10-21:07:01');
  });
});

describe('scheduler lifecycle', () => {
  it('starts one interval and stops without running more checks', async () => {
    mocks.list.mockResolvedValue([user('briefing')]);
    const scheduler = createDailyBriefingScheduler({ checkIntervalMs: 60000 });
    scheduler.start();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.list).toHaveBeenCalledOnce();
    expect(scheduler.getStatus().isRunning).toBe(true);
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(60000);
    expect(mocks.list).toHaveBeenCalledOnce();
    expect(scheduler.getStatus().isRunning).toBe(false);
  });
});
