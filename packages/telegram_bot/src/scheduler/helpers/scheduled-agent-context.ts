import type { Bot } from 'grammy';

import type { BotContext } from '../../bot/bot.js';
import type { TelegramUser } from '../../utils/user-lookup.js';

interface CreateScheduledAgentContextParams {
  bot: Bot<BotContext>;
  user: TelegramUser;
  messageText: string;
}

/**
 * Creates a production adapter for agent execution outside Telegram update handling.
 *
 * @param params Scheduled agent context parameters.
 * @return Bot-compatible context backed by direct Bot API calls.
 */
export function createScheduledAgentContext(params: CreateScheduledAgentContextParams): BotContext {
  const { bot, user, messageText } = params;
  const telegramId = user.telegram_id;

  return {
    api: bot.api,
    botInfo: bot.botInfo,
    chat: telegramId ? { id: telegramId, type: 'private' } : undefined,
    from: telegramId
      ? {
          id: telegramId,
          is_bot: false,
          first_name: user.username,
          username: user.username,
        }
      : undefined,
    message: {
      message_id: 0,
      date: Math.floor(Date.now() / 1000),
      chat: telegramId ? { id: telegramId, type: 'private' } : undefined,
      text: messageText,
    },
    session: { user },
    reply: async (text: string, options?: Parameters<typeof bot.api.sendMessage>[2]) => {
      if (!telegramId) return undefined;
      return bot.api.sendMessage(telegramId, text, options);
    },
    replyWithChatAction: async (action: Parameters<typeof bot.api.sendChatAction>[1]) => {
      if (!telegramId) return true;
      return bot.api.sendChatAction(telegramId, action);
    },
  } as unknown as BotContext;
}
