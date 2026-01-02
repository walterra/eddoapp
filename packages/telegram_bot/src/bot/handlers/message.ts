import { getEddoAgent } from '../../agent/index.js';
import { logger } from '../../utils/logger.js';
import type { BotContext } from '../bot.js';
import {
  logFailure,
  logFatalError,
  logSuccess,
  sendFatalErrorMessage,
  sendWorkflowErrorMessage,
} from './message-helpers.js';

interface AgentResult {
  success: boolean;
  finalResponse?: string;
  error?: Error;
}

async function processAgentResult(
  ctx: BotContext,
  result: AgentResult,
  userId: number,
): Promise<void> {
  if (result.success) {
    logSuccess(userId, !!result.finalResponse);
    if (result.finalResponse) {
      ctx.session.lastBotMessage = result.finalResponse;
    }
  } else {
    logFailure(userId, result.error);
    if (!result.finalResponse) {
      await sendWorkflowErrorMessage(ctx);
    }
  }
}

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

  logger.info('Processing message with agent workflow', {
    userId,
    messageLength: messageText.length,
    username: ctx.from?.username,
  });

  try {
    await ctx.replyWithChatAction('typing');

    const agent = getEddoAgent({
      enableStreaming: true,
      enableApprovals: true,
      maxExecutionTime: 300000,
    });

    const result = await agent.processMessage(messageText, userId.toString(), ctx);
    await processAgentResult(ctx, result, userId);
  } catch (error) {
    logFatalError(userId, error, messageText);
    await sendFatalErrorMessage(ctx);
  }
}
