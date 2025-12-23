import { getEddoAgent } from '../../agent/index.js';
import { logger } from '../../utils/logger.js';
import type { BotContext } from '../bot.js';

/**
 * Main message handler using the LangGraph agent workflow
 */
export async function handleMessage(ctx: BotContext): Promise<void> {
  const messageText = ctx.message?.text;
  const userId = ctx.from?.id;

  if (!messageText || !userId) {
    logger.warn('Invalid message or user ID', {
      messageText: !!messageText,
      userId,
    });
    return;
  }

  logger.info('Processing message with agent workflow', {
    userId,
    messageLength: messageText.length,
    username: ctx.from?.username,
  });

  try {
    // Show typing indicator while processing
    await ctx.replyWithChatAction('typing');

    // Get the agent instance
    const agent = getEddoAgent({
      enableStreaming: true,
      enableApprovals: true,
      maxExecutionTime: 300000, // 5 minutes
    });

    // Process the message through the agent workflow
    const result = await agent.processMessage(messageText, userId.toString(), ctx);

    // Log the result
    if (result.success) {
      logger.info('Agent workflow completed successfully', {
        userId,
        hasResponse: !!result.finalState.finalResponse,
      });

      // Note: Agent already sends conversational responses directly during processing
      // Store the final response for session tracking without sending duplicate
      if (result.finalState.finalResponse) {
        ctx.session.lastBotMessage = result.finalState.finalResponse;
      }
    } else {
      logger.error('Agent workflow failed', {
        userId,
        error: result.error?.message,
        errorStack: result.error?.stack,
      });

      // Send error message if not already handled
      if (!result.finalState.finalResponse) {
        await ctx.reply(
          '❌ Sorry, I encountered an error processing your request. Please try again.',
          { parse_mode: 'Markdown' },
        );
      }
    }
  } catch (error) {
    logger.error('Fatal error in agent message handler', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId,
      messageText: messageText.substring(0, 100), // Log first 100 chars only
    });

    // Send fallback error message
    await ctx.reply(
      '🔧 Something went wrong. Please try again or contact support if the issue persists.',
    );
  }
}
