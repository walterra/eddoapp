import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../bot/bot.js';
import { handleMessage } from '../bot/handlers/message.js';
import { deliveredRequestFailure } from './request_failure.js';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), fatal: vi.fn(), success: vi.fn() }));
vi.mock('./routing.js', () => ({ executeAgentMessage: mocks.execute }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
  SpanAttributes: {},
  withSpan: (_name: string, _attributes: unknown, action: () => Promise<void>) => action(),
}));
vi.mock('../bot/handlers/message-helpers.js', () => ({
  logFatalError: vi.fn(),
  logSuccess: mocks.success,
  sendFatalErrorMessage: mocks.fatal,
}));

function context(): BotContext {
  return {
    message: { text: 'List tasks' },
    from: { id: 123 },
    chat: { id: 123 },
    session: {},
    replyWithChatAction: vi.fn(),
  } as unknown as BotContext;
}

beforeEach(() => vi.clearAllMocks());

describe('durable failure delivery in Telegram handling', () => {
  it('does not send a second failure reply or log success for an already delivered notice', async () => {
    mocks.execute.mockRejectedValue(deliveredRequestFailure('Generation failed'));
    await handleMessage(context());
    expect(mocks.fatal).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('still notifies the user when failure occurs before durable delivery', async () => {
    mocks.execute.mockRejectedValue(new Error('Database unavailable'));
    await handleMessage(context());
    expect(mocks.fatal).toHaveBeenCalledOnce();
  });
});
