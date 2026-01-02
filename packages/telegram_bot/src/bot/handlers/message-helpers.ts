import { logger } from '../../utils/logger.js';
import type { BotContext } from '../bot.js';

/**
 * Logs successful agent workflow completion
 * @param userId - Telegram user ID
 * @param hasResponse - Whether a response was generated
 */
export function logSuccess(userId: number, hasResponse: boolean): void {
  logger.info('Agent workflow completed successfully', { userId, hasResponse });
}

/**
 * Logs agent workflow failure
 * @param userId - Telegram user ID
 * @param error - Error that occurred
 */
export function logFailure(userId: number, error?: Error): void {
  logger.error('Agent workflow failed', {
    userId,
    error: error?.message,
    errorStack: error?.stack,
  });
}

/**
 * Logs fatal error in message handler
 * @param userId - Telegram user ID
 * @param error - Error that occurred
 * @param messageText - Original message text
 */
export function logFatalError(userId: number, error: unknown, messageText: string): void {
  logger.error('Fatal error in agent message handler', {
    error: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : undefined,
    userId,
    messageText: messageText.substring(0, 100),
  });
}

/**
 * Sends error message when agent workflow fails
 * @param ctx - Bot context
 */
export async function sendWorkflowErrorMessage(ctx: BotContext): Promise<void> {
  await ctx.reply('❌ Sorry, I encountered an error processing your request. Please try again.', {
    parse_mode: 'Markdown',
  });
}

/**
 * Sends fallback error message for fatal errors
 * @param ctx - Bot context
 */
export async function sendFatalErrorMessage(ctx: BotContext): Promise<void> {
  await ctx.reply(
    '🔧 Something went wrong. Please try again or contact support if the issue persists.',
  );
}
