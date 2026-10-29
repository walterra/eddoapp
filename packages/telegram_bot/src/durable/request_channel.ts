import type {
  AssistantMessageChannelMetadata,
  AssistantRequest,
  AssistantRequestSource,
} from '@eddo/core-shared';
import type { DurableRequestInput } from './state.js';

/** Normalizes persisted Telegram inputs without rewriting journal records. */
export function normalizeTelegramRequest(
  username: string,
  input: DurableRequestInput,
): AssistantRequest {
  return {
    account: { username },
    requestId: input.requestId,
    conversationId: input.conversationId,
    text: input.text,
    source: {
      channel: 'telegram',
      telegram: {
        chatId: input.chatId,
        userId: input.telegramId,
        messageId: input.messageId,
      },
    },
    createdAt: input.createdAt,
    deadline: input.deadline,
    ...(input.report ? { report: input.report } : {}),
  };
}

/** Produces history metadata without inventing Telegram identifiers for web requests. */
export function requestChannelMetadata(
  source: AssistantRequestSource,
): AssistantMessageChannelMetadata | undefined {
  switch (source.channel) {
    case 'telegram':
      return { telegram: source.telegram };
    case 'web':
      return undefined;
    default: {
      const unexpected: never = source;
      throw new Error(`Unsupported assistant request source: ${String(unexpected)}`);
    }
  }
}
