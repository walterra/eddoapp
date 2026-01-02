/**
 * Agent execution utilities for scheduled tasks
 */
import { SimpleAgent } from '../../agent/simple-agent.js';
import type { BotContext } from '../../bot/bot.js';
import { logger } from '../../utils/logger.js';
import type { TelegramUser } from '../../utils/user-lookup.js';

interface AgentExecutionResult {
  success: boolean;
  message: string;
  hasMarker: boolean;
}

/**
 * Creates a minimal mock context for agent execution
 */
function createMockContext(user: TelegramUser, messageText: string): BotContext {
  return {
    from: { id: user.telegram_id },
    message: { text: messageText },
  } as BotContext;
}

/**
 * Executes the agent to generate briefing/recap content
 */
export async function executeAgentForUser(
  user: TelegramUser,
  requestMessage: string,
  contentMarker: string,
  contentType: 'briefing' | 'recap',
): Promise<AgentExecutionResult> {
  logger.info(`Generating ${contentType} for user via agent`, {
    userId: user._id,
    username: user.username,
    telegramId: user.telegram_id,
  });

  const agent = new SimpleAgent();
  const mockContext = createMockContext(user, requestMessage);

  const result = await agent.execute(requestMessage, user._id, mockContext);
  const message = result.finalResponse || `❌ Failed to generate ${contentType}`;
  const hasMarker = message.includes(contentMarker);

  return { success: result.success, message, hasMarker };
}
