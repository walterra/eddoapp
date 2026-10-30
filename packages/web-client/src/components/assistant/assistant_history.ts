import type { AssistantConversationMessageDoc, AssistantHistoryPage } from '@eddo/core-shared';
import type { AssistantSnapshot } from './assistant_types';

function compare(
  left: AssistantConversationMessageDoc,
  right: AssistantConversationMessageDoc,
): number {
  return (
    left.sequence - right.sequence ||
    left.createdAt.localeCompare(right.createdAt) ||
    left._id.localeCompare(right._id)
  );
}

function retainHistory(
  state: AssistantSnapshot,
  page: AssistantHistoryPage,
  older: boolean,
): boolean {
  if (state.conversation?._id !== page.conversation?._id) return false;
  if (older) return true;
  if (!page.messages.length) return false;
  const ids = new Set(state.messages.map((message) => message._id));
  const newest = state.messages[state.messages.length - 1]?.sequence ?? 0;
  return (
    page.messages.some((message) => ids.has(message._id)) || page.messages[0].sequence <= newest + 1
  );
}

/** Merges stable projection IDs and resets old windows when a reconnect skips beyond loaded history. */
export function mergeAssistantHistory(
  state: AssistantSnapshot,
  page: AssistantHistoryPage,
  older: boolean,
): Partial<AssistantSnapshot> {
  const retain = retainHistory(state, page, older);
  const messages = new Map((retain ? state.messages : []).map((message) => [message._id, message]));
  for (const message of page.messages) messages.set(message._id, message);
  return {
    conversation: page.conversation,
    messages: [...messages.values()].sort(compare),
    loading: false,
    nextCursor: older || !retain || !state.messages.length ? page.nextCursor : state.nextCursor,
  };
}
