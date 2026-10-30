import type {
  AssistantMessageChannelMetadata,
  AssistantRequest,
  AssistantRequestSource,
} from '@eddo/core-shared';
import type { DurableRequestInput, RuntimeRequestInput } from './state.js';

/** Resolves legacy and channel-neutral inputs without changing their persisted shape. */
export function assistantRequest(username: string, input: RuntimeRequestInput): AssistantRequest {
  return 'account' in input ? input : normalizeTelegramRequest(username, input);
}

/** Identifies web requests before invoking Telegram transport or formatting. */
export function isWebRequest(input: RuntimeRequestInput): boolean {
  return 'source' in input && input.source.channel === 'web';
}

/** Resolves private Telegram destinations from either persisted request format. */
export function telegramChatId(input: RuntimeRequestInput): number {
  if (!('source' in input)) return input.chatId;
  if (input.source.channel !== 'telegram')
    throw new Error('Web requests have no Telegram destination');
  return input.source.telegram.chatId;
}

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
