import type { Bot } from 'grammy';
import { describe, expect, it, vi } from 'vitest';

import type { BotContext } from '../../bot/bot.js';
import type { TelegramUser } from '../../utils/user-lookup.js';
import { createScheduledAgentContext } from './scheduled-agent-context.js';

function createUser(): TelegramUser {
  return {
    _id: 'user_test',
    username: 'test-user',
    email: 'test@example.com',
    telegram_id: 12345,
    database_name: 'eddo_test',
    status: 'active',
    permissions: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    preferences: {
      dailyBriefing: true,
      dailyRecap: false,
    },
  };
}

function createBot(): Bot<BotContext> {
  return {
    api: {
      sendMessage: vi.fn(),
      sendChatAction: vi.fn(),
    },
    botInfo: {
      id: 1,
      is_bot: true,
      first_name: 'test-bot',
      username: 'test_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    },
  } as unknown as Bot<BotContext>;
}

describe('createScheduledAgentContext', () => {
  it('leaves delivery and printing exclusively to the scheduler', async () => {
    const bot = createBot();
    const user = createUser();
    user.preferences = { ...user.preferences, printBriefing: true, printRecap: true };
    const context = createScheduledAgentContext({ bot, user, messageText: 'briefing' });

    await context.reply('Gathering your accomplishments...');
    await context.reply('DAILY RECAP');

    expect(bot.api.sendMessage).not.toHaveBeenCalled();
    expect(context.session.user?.preferences).toMatchObject({
      printBriefing: false,
      printRecap: false,
    });
    expect(user.preferences.printBriefing).toBe(true);
  });

  it('creates the complete session required by agent helpers', () => {
    const user = createUser();
    const context = createScheduledAgentContext({
      bot: createBot(),
      user,
      messageText: 'briefing',
    });

    expect(context.session).toMatchObject({
      userId: user._id,
      context: {},
      user,
    });
    expect(context.session.lastActivity).toBeInstanceOf(Date);
  });
});
