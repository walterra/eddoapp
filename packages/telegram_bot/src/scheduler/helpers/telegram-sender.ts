/**
 * Telegram message sending utilities for scheduled tasks
 */
import type { Bot } from 'grammy';

import type { BotContext } from '../../bot/bot.js';
import { logger } from '../../utils/logger.js';

interface SendMessageOptions {
  telegramId: number;
  message: string;
  parseMode?: 'Markdown' | 'HTML';
  disableLinkPreview?: boolean;
}

/**
 * Sends a message to a Telegram user
 */
export async function sendTelegramMessage(
  bot: Bot<BotContext>,
  options: SendMessageOptions,
): Promise<void> {
  const { telegramId, message, parseMode = 'Markdown', disableLinkPreview = false } = options;

  await bot.api.sendMessage(telegramId, message, {
    parse_mode: parseMode,
    link_preview_options: disableLinkPreview ? { is_disabled: true } : undefined,
  });
}

/**
 * Strips content markers from a message
 */
export function stripMarker(message: string, marker: string): string {
  return message.replaceAll(marker, '');
}

interface LogSuccessfulSendOptions {
  contentType: 'briefing' | 'recap';
  userId: string;
  username: string;
  telegramId: number;
  messageLength: number;
}

/**
 * Logs successful send
 */
export function logSuccessfulSend(options: LogSuccessfulSendOptions): void {
  const { contentType, userId, username, telegramId, messageLength } = options;
  logger.info(
    `${contentType === 'briefing' ? 'Daily briefing' : 'Recap'} sent successfully via agent`,
    {
      userId,
      username,
      telegramId,
      outputLength: messageLength,
    },
  );
}
