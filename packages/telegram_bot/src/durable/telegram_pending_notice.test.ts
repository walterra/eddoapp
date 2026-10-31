import type { TaskId } from '@earendil-works/pi-durable';
import { waitForRequestResult } from '@eddo/assistant-server/request_wait';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../bot/bot.js';
import { handleMessage } from '../bot/handlers/message.js';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  fatal: vi.fn(),
  fatalLog: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));
vi.mock('./routing.js', () => ({ executeAgentMessage: mocks.execute }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: mocks.info, warn: vi.fn() },
  SpanAttributes: {},
  withSpan: (_name: string, _attributes: unknown, action: () => Promise<void>) => action(),
}));
vi.mock('../bot/handlers/message-helpers.js', () => ({
  logFatalError: mocks.fatalLog,
  logSuccess: mocks.success,
  sendFatalErrorMessage: mocks.fatal,
}));

beforeEach(() => vi.clearAllMocks());

describe('pending Telegram notice', () => {
  it('sends a pending notice without claiming failure, success, or suggesting a retry', async () => {
    const error = await waitForRequestResult(
      {
        waitForTask: vi.fn().mockRejectedValue(new Error('Wait interrupted')),
      },
      1 as TaskId<string>,
      { requestId: 'telegram:bot:1' },
    ).catch((reason: unknown) => reason);
    mocks.execute.mockRejectedValue(error);
    const reply = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      message: { text: 'Save task' },
      from: { id: 123 },
      chat: { id: 123 },
      session: { lastBotMessage: 'Previous answer' },
      replyWithChatAction: vi.fn(),
      reply,
    } as unknown as BotContext;
    await handleMessage(ctx);
    expect(reply).toHaveBeenCalledOnce();
    expect(reply).toHaveBeenCalledWith(expect.stringContaining('still pending'));
    expect(reply).toHaveBeenCalledWith(expect.stringContaining('do not repeat'));
    expect(ctx.session.lastBotMessage).toBe('Previous answer');
    expect(mocks.fatal).not.toHaveBeenCalled();
    expect(mocks.fatalLog).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
