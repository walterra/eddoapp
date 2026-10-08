/**
 * Agent execution utilities for scheduled tasks
 */
import type { Bot } from 'grammy';

import { SimpleAgent } from '../../agent/simple-agent.js';
import type { BotContext } from '../../bot/bot.js';
import { logger } from '../../utils/logger.js';
import type { TelegramUser } from '../../utils/user-lookup.js';

import { createScheduledAgentContext } from './scheduled-agent-context.js';

interface AgentExecutionResult {
  success: boolean;
  message: string;
  hasMarker: boolean;
}

interface ExecuteAgentForUserParams {
  bot: Bot<BotContext>;
  user: TelegramUser;
  requestMessage: string;
  contentMarker: string;
  contentType: 'briefing' | 'recap';
}

/**
 * Executes the agent to generate briefing/recap content.
 *
 * @param params Agent execution parameters.
 * @return Agent execution result.
 */
export async function executeAgentForUser(
  params: ExecuteAgentForUserParams,
): Promise<AgentExecutionResult> {
  const { bot, user, requestMessage, contentMarker, contentType } = params;
  logger.info(`Generating ${contentType} for user via agent`, {
    userId: user._id,
    username: user.username,
    telegramId: user.telegram_id,
  });

  const agent = new SimpleAgent();
  const scheduledContext = createScheduledAgentContext({ bot, user, messageText: requestMessage });

  const result = await agent.execute(requestMessage, user._id, scheduledContext, {
    replyOnError: false,
  });
  const message = result.finalResponse || `❌ Failed to generate ${contentType}`;
  const hasMarker = message.includes(contentMarker);

  return { success: result.success, message, hasMarker };
}
