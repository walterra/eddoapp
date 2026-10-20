import type { WorkflowResult } from '../agent/types/workflow-types.js';
import { startPeriodicTyping, stopPeriodicTyping } from '../agent/typing-indicator.js';
import type { BotContext } from '../bot/bot.js';
import { parseDurableConfig } from './config.js';

/** Checks explicit pilot enrollment without loading the durable SDK. */
export function usesDurableRuntime(ctx: BotContext): boolean {
  const username = ctx.session.user?.username;
  return Boolean(username && parseDurableConfig(process.env).users.includes(username));
}

/** Uses Durable only for enrolled interactive users; never retries via the legacy agent. */
export async function routeAgentMessage(
  text: string,
  ctx: BotContext,
  legacy: () => Promise<WorkflowResult>,
): Promise<WorkflowResult> {
  if (!usesDurableRuntime(ctx)) return legacy();
  const { executeDurableMessage } = await import('./host.js');
  const typing = startPeriodicTyping(ctx);
  try {
    const finalResponse = await executeDurableMessage(text, ctx);
    return { success: true, finalResponse };
  } finally {
    stopPeriodicTyping(typing);
  }
}
