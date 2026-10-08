import type { BotContext } from '../bot/bot.js';
import { logger } from '../utils/logger.js';

interface HandleAgentExecutionErrorParams {
  error: unknown;
  userId: string;
  startTime: number;
  telegramContext: BotContext;
  replyOnError: boolean;
}

/** Logs an agent failure and optionally reports it to the Telegram user. */
export async function handleAgentExecutionError(
  params: HandleAgentExecutionErrorParams,
): Promise<{ success: false; error: Error }> {
  const { error, userId, startTime, telegramContext, replyOnError } = params;
  const normalizedError = error instanceof Error ? error : new Error(String(error));

  logger.error('Simple agent failed', {
    error: normalizedError.message,
    userId,
    duration: Date.now() - startTime,
  });

  if (replyOnError) {
    try {
      await telegramContext.reply(
        '❌ Sorry, I encountered an error processing your request. Please try again.',
      );
    } catch (replyError) {
      logger.error('Failed to send error message to user', { replyError });
    }
  }

  return { success: false, error: normalizedError };
}
