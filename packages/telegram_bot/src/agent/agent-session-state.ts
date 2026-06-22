import type { BotContext } from '../bot/bot.js';
import type { AssistantChatHistoryStore } from './chat-history-store.js';
import type { AgentState } from './helpers/types.js';

interface PersistAgentExchangeParams {
  historyStore: AssistantChatHistoryStore;
  telegramContext: BotContext;
  state: AgentState;
  userInput: string;
  assistantResponse: string;
}

/** Creates agent state from persisted assistant history and the current user input. */
export async function initializeAgentState(
  historyStore: AssistantChatHistoryStore,
  userInput: string,
  telegramContext: BotContext,
): Promise<AgentState> {
  const conversation = await historyStore.loadConversation(telegramContext);
  const history = [
    ...(conversation?.history ?? []),
    { role: 'user' as const, content: userInput, timestamp: Date.now() },
  ];

  return {
    input: userInput,
    history,
    done: false,
    toolResults: [],
    conversationId: conversation?.conversationId,
    cacheSessionId: conversation?.cacheSessionId,
  };
}

/** Persists a completed assistant exchange when a conversation exists. */
export async function persistAgentExchange(params: PersistAgentExchangeParams): Promise<void> {
  const { historyStore, telegramContext, state, userInput, assistantResponse } = params;
  if (!state.conversationId) return;

  await historyStore.persistExchange(telegramContext, {
    conversationId: state.conversationId,
    userMessage: userInput,
    assistantMessage: assistantResponse,
  });
}
