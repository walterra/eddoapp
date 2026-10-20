import type { BotContext } from '../bot/bot.js';
import { getMCPClient } from '../mcp/client.js';
import { appConfig } from '../utils/config.js';
import { logger, SpanAttributes, withSpan } from '../utils/logger.js';
import { startPeriodicTyping, stopPeriodicTyping } from './typing_indicator.js';

export interface DurableAgentStatus {
  version: string;
  workflowType: string;
  model: string;
  uptime: number;
  mcpToolsAvailable: number;
}

/** Processes every authenticated message through the single durable runtime. */
export async function executeAgentMessage(text: string, ctx: BotContext): Promise<string> {
  const typing = startPeriodicTyping(ctx);
  try {
    return await withSpan(
      'agent_execute',
      {
        [SpanAttributes.USER_ID]: ctx.from?.id.toString() ?? '',
        'message.length': text.length,
      },
      async () => {
        const { executeDurableMessage } = await import('./host.js');
        const answer = await executeDurableMessage(text, ctx);
        logger.info('Durable agent completed', {
          username: ctx.session.user?.username,
          responseLength: answer.length,
        });
        return answer;
      },
    );
  } finally {
    stopPeriodicTyping(typing);
  }
}

/** Returns runtime identity without opening a journal or admitting work. */
export function getAgentStatus(): DurableAgentStatus {
  return {
    version: '1.3.0',
    workflowType: 'Pi Durable',
    model: appConfig.LLM_MODEL,
    uptime: process.uptime(),
    mcpToolsAvailable: getMCPClient()?.tools.length ?? 0,
  };
}
