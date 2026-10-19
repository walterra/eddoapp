import type { Bot } from 'grammy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../bot/bot.js';
import type { TelegramUser } from '../utils/user-lookup.js';
import { DailyBriefingScheduler } from './daily-briefing.js';

const mocks = vi.hoisted(() => ({
  documents: new Map<string, string>(),
  execute: vi.fn(),
  send: vi.fn(),
  list: vi.fn(),
}));
vi.mock('@eddo/core-server', () => ({
  createEnv: () => ({ COUCHDB_URL: 'http://localhost:5984' }),
  createUserRegistry: () => ({ list: mocks.list }),
  normalizeTimeZone: () => 'UTC',
  formatTimeInTimeZone: (date: Date) => date.toISOString().slice(11, 16),
  formatDateInTimeZone: (date: Date) => date.toISOString().slice(0, 10),
}));
vi.mock('nano', () => ({
  default: () => ({
    db: {
      use: () => ({
        insert: async (document: { _id: string }) => {
          if (mocks.documents.has(document._id)) throw { statusCode: 409 };
          mocks.documents.set(document._id, '1');
          return { rev: '1' };
        },
        destroy: async (id: string) => {
          mocks.documents.delete(id);
        },
      }),
    },
  }),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
  SpanAttributes: {},
  withSpan: async (_name: string, _attributes: unknown, action: () => Promise<unknown>) => action(),
}));
vi.mock('./helpers/index.js', () => ({
  executeAgentForUser: mocks.execute,
  sendTelegramMessage: mocks.send,
  sendBriefingWithoutMarker: mocks.send,
  stripMarker: (text: string) => text,
  logSuccessfulSend: vi.fn(),
  printIfEnabled: vi.fn(),
}));

interface SchedulerChecks {
  checkAndSendBriefings(): Promise<void>;
}
function scheduler(): SchedulerChecks {
  return new DailyBriefingScheduler({
    bot: {} as Bot<BotContext>,
    checkIntervalMs: 60000,
  }) as unknown as SchedulerChecks;
}
function user(type: string): TelegramUser {
  return {
    _id: 'user_test',
    username: 'test',
    telegram_id: 123,
    database_name: 'eddo_test',
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
  vi.setSystemTime(new Date('2026-10-19T07:00:00Z'));
  mocks.documents.clear();
  vi.clearAllMocks();
  mocks.execute.mockResolvedValue({ success: true, message: 'report', hasMarker: false });
  mocks.send.mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

describe.each(['briefing', 'recap'])('%s reservations', (type) => {
  beforeEach(() => mocks.list.mockResolvedValue([user(type)]));

  it('blocks overlapping checks and separate scheduler instances while generation is pending', async () => {
    let finish!: (value: unknown) => void;
    mocks.execute.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = scheduler().checkAndSendBriefings();
    await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(1));
    await scheduler().checkAndSendBriefings();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    finish({ success: true, message: 'report', hasMarker: false });
    await first;
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('survives scheduler restart and permits the next local day', async () => {
    await scheduler().checkAndSendBriefings();
    await scheduler().checkAndSendBriefings();
    expect(mocks.send).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-10-20T07:00:00Z'));
    await scheduler().checkAndSendBriefings();
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it('does not deliver unsuccessful generation and releases its reservation for retry', async () => {
    mocks.execute.mockResolvedValueOnce({ success: false, message: 'failure', hasMarker: false });
    await scheduler().checkAndSendBriefings();
    expect(mocks.send).not.toHaveBeenCalled();
    await scheduler().checkAndSendBriefings();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('keeps the same scheduler from sending again after completion', async () => {
    const instance = scheduler();
    await instance.checkAndSendBriefings();
    await instance.checkAndSendBriefings();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('allows a same-day schedule change without reusing the previous reservation', async () => {
    await scheduler().checkAndSendBriefings();
    const updatedUser = user(type);
    updatedUser.preferences = {
      ...updatedUser.preferences,
      briefingTime: '07:01',
      recapTime: '07:01',
    };
    mocks.list.mockResolvedValue([updatedUser]);
    vi.setSystemTime(new Date('2026-10-19T07:01:00Z'));
    await scheduler().checkAndSendBriefings();
    await scheduler().checkAndSendBriefings();
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it('fails closed after an unexpected exception rather than creating repeated runs', async () => {
    mocks.execute.mockRejectedValueOnce(new Error('unexpected interruption'));
    await scheduler().checkAndSendBriefings();
    await scheduler().checkAndSendBriefings();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('does not retry ambiguous delivery errors', async () => {
    mocks.send.mockRejectedValueOnce(new Error('connection lost after send'));
    await scheduler().checkAndSendBriefings();
    await scheduler().checkAndSendBriefings();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
});
