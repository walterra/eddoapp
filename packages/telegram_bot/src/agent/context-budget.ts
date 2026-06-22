import { resolveConfiguredModel } from '../ai/llm-model-resolution.js';
import type { BotContext } from '../bot/bot.js';
import type { AgentState } from './helpers/types.js';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_CONTEXT_WINDOW = 200000;
const CONTEXT_WARNING_RATIO = 0.8;
const APPROXIMATE_CHARS_PER_TOKEN = 4;

/** Returns the configured model context window. */
function getContextWindow(): number {
  try {
    return resolveConfiguredModel(process.env.LLM_MODEL || DEFAULT_MODEL).model.contextWindow;
  } catch {
    return DEFAULT_CONTEXT_WINDOW;
  }
}

/** Estimates prompt tokens from message and system prompt characters. */
function estimateTokenCount(systemPrompt: string, history: AgentState['history']): number {
  const historyChars = history.reduce((sum, message) => sum + message.content.length, 0);
  return Math.ceil((systemPrompt.length + historyChars) / APPROXIMATE_CHARS_PER_TOKEN);
}

/** Warns once per conversation when model context is nearing capacity. */
export async function warnWhenContextIsLarge(
  telegramContext: BotContext,
  state: AgentState,
  systemPrompt: string,
): Promise<void> {
  if (!state.conversationId) return;

  const warningKey = `context-warning:${state.conversationId}`;
  if (telegramContext.session.context[warningKey]) return;

  const tokenEstimate = estimateTokenCount(systemPrompt, state.history);
  if (tokenEstimate < getContextWindow() * CONTEXT_WARNING_RATIO) return;

  telegramContext.session.context[warningKey] = true;
  await telegramContext.reply('This conversation is getting long. Use /new to start fresh.');
}
