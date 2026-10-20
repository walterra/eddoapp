import { executeAgentMessage } from '../../durable/routing.js';
import { logger, SpanAttributes, withSpan } from '../../utils/logger.js';
import type { BotContext } from '../bot.js';
import { logFatalError, logSuccess, sendFatalErrorMessage } from './message-helpers.js';

/**
 * Handles incoming text messages using the AI agent workflow
 */
export async function handleMessage(ctx: BotContext): Promise<void> {
  const messageText = ctx.message?.text;
  const userId = ctx.from?.id;

  if (!messageText || !userId) {
    logger.warn('Invalid message or user ID', { messageText: !!messageText, userId });
    return;
  }

  return withSpan(
    'telegram_message_handle',
    {
      [SpanAttributes.TELEGRAM_CHAT_ID]: ctx.chat?.id ?? 0,
      [SpanAttributes.USER_ID]: userId.toString(),
      'message.length': messageText.length,
    },
    async () => {
      logger.info('Processing message with agent workflow', {
        userId,
        messageLength: messageText.length,
        username: ctx.from?.username,
      });

      try {
        await ctx.replyWithChatAction('typing');

        ctx.session.lastBotMessage = await executeAgentMessage(messageText, ctx);
        logSuccess(userId, Boolean(ctx.session.lastBotMessage));
      } catch (error) {
        logFatalError(userId, error, messageText);
        await sendFatalErrorMessage(ctx);
      }
    },
  );
}
