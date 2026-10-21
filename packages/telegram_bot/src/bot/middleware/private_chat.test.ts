import type { Update } from 'grammy/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBot, type BotContext } from '../bot.js';
import { privateChatMiddleware } from './private_chat.js';

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('../../utils/config.js', () => ({ appConfig: { TELEGRAM_BOT_TOKEN: '123:test' } }));
vi.mock('./auth.js', () => ({ authMiddleware: mocks.auth }));
vi.mock('../bot-middleware.js', () => ({
  createLoggingMiddleware: () => (_ctx: unknown, next: () => Promise<void>) => next(),
  createRateLimitMiddleware: () => (_ctx: unknown, next: () => Promise<void>) => next(),
}));

type ChatType = 'private' | 'group' | 'supergroup';

function update(type: ChatType, text: string): Update {
  const chat =
    type === 'private'
      ? { id: 123, type, first_name: 'Alice' }
      : { id: -100, type, title: 'Group' };
  return {
    update_id: 1,
    message: {
      message_id: 2,
      date: 1_000_000,
      chat,
      text,
      from: { id: 123, is_bot: false, first_name: 'Alice' },
    },
  };
}

function botFixture() {
  const bot = createBot();
  bot.botInfo = {
    id: 77,
    is_bot: true,
    first_name: 'Eddo',
    username: 'eddo_test_bot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };
  const transport = vi.fn().mockResolvedValue({ ok: true, result: true });
  bot.api.config.use(transport);
  return { bot, transport };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockImplementation((_ctx: BotContext, next: () => Promise<void>) => next());
});

describe('private-chat entry boundary', () => {
  it.each(['group', 'supergroup'] as const)(
    'redirects %s messages before authentication, sessions, or agent execution',
    async (type) => {
      const { bot, transport } = botFixture();
      const handler = vi.fn();
      bot.on('message:text', handler);
      await bot.handleUpdate(update(type, 'Show my private tasks'));
      expect(mocks.auth).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      expect(transport).toHaveBeenCalledOnce();
      const [, method, payload] = transport.mock.calls[0];
      expect(method).toBe('sendMessage');
      expect(payload).toMatchObject({
        chat_id: -100,
        text: expect.stringContaining('only in private chats'),
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Open private chat',
                url: 'https://t.me/eddo_test_bot',
              },
            ],
          ],
        },
      });
      expect(JSON.stringify(payload)).not.toContain('Show my private tasks');
    },
  );

  it('blocks group commands before account or configuration side effects', async () => {
    const { bot } = botFixture();
    const command = vi.fn();
    bot.command('new', command);
    const request = update('group', '/new');
    if (request.message && 'text' in request.message)
      request.message.entities = [{ type: 'bot_command', offset: 0, length: 4 }];
    await bot.handleUpdate(request);
    expect(command).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it('preserves private-chat authentication and session initialization', async () => {
    const { bot, transport } = botFixture();
    const handler = vi.fn((ctx: BotContext) => {
      expect(ctx.session).toMatchObject({ userId: '', context: {} });
    });
    bot.on('message:text', handler);
    await bot.handleUpdate(update('private', 'Show my tasks'));
    expect(mocks.auth).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
    expect(transport).not.toHaveBeenCalled();
  });

  it('ignores non-text and chatless updates without authentication or replies', async () => {
    const next = vi.fn();
    const reply = vi.fn();
    for (const chat of [{ type: 'group' }, { type: 'channel' }, undefined]) {
      const ctx = { chat, reply } as unknown as BotContext;
      await privateChatMiddleware(ctx, next);
    }
    expect(next).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  it('does not access group sessions when issuing guidance', async () => {
    const ctx = {
      chat: { type: 'group' },
      message: { text: 'Hello' },
      me: { username: 'eddo_test_bot' },
      reply: vi.fn(),
      get session(): never {
        throw new Error('Group session accessed');
      },
    } as unknown as BotContext;
    const next = vi.fn();
    await privateChatMiddleware(ctx, next);
    expect(ctx.reply).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });
});
