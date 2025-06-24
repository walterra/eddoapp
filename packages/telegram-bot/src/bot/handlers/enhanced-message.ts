import { getEddoAgent } from '../../agent/index.js';
import { logger } from '../../utils/logger.js';
import type { BotContext } from '../bot.js';

/**
 * Enhanced message handler using the LangGraph agent workflow
 * This replaces the original message handler with agent-based processing
 */
export async function handleMessageWithAgent(ctx: BotContext): Promise<void> {
  const messageText = ctx.message?.text;
  const userId = ctx.from?.id;

  if (!messageText || !userId) {
    logger.warn('Invalid message or user ID', { messageText: !!messageText, userId });
    return;
  }

  logger.info('Processing message with agent workflow', { 
    userId, 
    messageLength: messageText.length,
    username: ctx.from?.username
  });

  try {
    // Get the agent instance
    const agent = getEddoAgent({
      enableStreaming: true,
      enableApprovals: true,
      maxExecutionTime: 300000 // 5 minutes
    });

    // Process the message through the agent workflow
    const result = await agent.processMessage(
      messageText,
      userId.toString(),
      ctx
    );

    // Log the result
    if (result.success) {
      logger.info('Agent workflow completed successfully', {
        userId,
        hasSummary: !!result.summary,
        complexity: result.finalState.complexityAnalysis?.classification,
        stepsExecuted: result.finalState.executionSteps.length
      });

      // Update session with the last bot message
      if (result.finalState.finalResponse) {
        ctx.session.lastBotMessage = result.finalState.finalResponse;
      }
    } else {
      logger.error('Agent workflow failed', {
        userId,
        error: result.error?.message,
        errorStack: result.error?.stack
      });

      // Send error message if not already handled
      if (!result.finalState.finalResponse) {
        await ctx.reply(
          '❌ Sorry, I encountered an error processing your request. Please try again.',
          { parse_mode: 'Markdown' }
        );
      }
    }

  } catch (error) {
    logger.error('Fatal error in agent message handler', {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      userId,
      messageText: messageText.substring(0, 100) // Log first 100 chars only
    });

    // Send fallback error message
    await ctx.reply(
      '🔧 Something went wrong. Please try again or contact support if the issue persists.'
    );
  }
}

/**
 * Fallback to original message handler for compatibility
 * This allows gradual migration and rollback if needed
 */
export async function handleMessageWithFallback(ctx: BotContext): Promise<void> {
  const messageText = ctx.message?.text;
  const userId = ctx.from?.id;

  if (!messageText || !userId) {
    return;
  }

  logger.info('Using enhanced message handler with agent fallback', { userId });

  try {
    // Try agent workflow first
    await handleMessageWithAgent(ctx);
  } catch (agentError) {
    logger.warn('Agent workflow failed, falling back to original handler', {
      agentError: agentError instanceof Error ? agentError.message : String(agentError),
      userId
    });

    try {
      // Import and use original handler as fallback
      const { handleMessage: originalHandler } = await import('./message.js');
      await originalHandler(ctx);
    } catch (fallbackError) {
      logger.error('Both agent and fallback handlers failed', {
        agentError: agentError instanceof Error ? agentError.message : String(agentError),
        fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        userId
      });

      await ctx.reply(
        '🚨 System error. Please try again later or contact support.'
      );
    }
  }
}

/**
 * Configuration flag to enable/disable agent workflow
 * Can be controlled via environment variable
 */
const ENABLE_AGENT_WORKFLOW = process.env.ENABLE_AGENT_WORKFLOW !== 'false';

/**
 * Main message handler that routes to appropriate implementation
 */
export async function handleMessageEnhanced(ctx: BotContext): Promise<void> {
  if (ENABLE_AGENT_WORKFLOW) {
    await handleMessageWithFallback(ctx);
  } else {
    // Use original handler
    const { handleMessage: originalHandler } = await import('./message.js');
    await originalHandler(ctx);
  }
}
