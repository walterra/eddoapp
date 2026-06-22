import type { BotContext } from '../bot/bot.js';
import { logger } from '../utils/logger.js';

/** Shows Telegram typing indicator if possible. */
export async function showTyping(telegramContext: BotContext): Promise<void> {
  try {
    await telegramContext.replyWithChatAction('typing');
  } catch (error) {
    logger.debug('Failed to show typing indicator', { error });
  }
}

/** Starts periodic Telegram typing indicator updates. */
export function startPeriodicTyping(telegramContext: BotContext): NodeJS.Timeout {
  return setInterval(async () => {
    await showTyping(telegramContext);
  }, 4000);
}

/** Stops periodic Telegram typing indicator updates. */
export function stopPeriodicTyping(interval: NodeJS.Timeout): void {
  clearInterval(interval);
}
