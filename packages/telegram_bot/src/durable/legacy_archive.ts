import type { AssistantConversationMessageDoc } from '@eddo/core-shared';

const MAX_PAGE_CHARS = 8000;
const MAX_PAGE_MESSAGES = 20;

export interface LegacyArchiveQuery {
  query?: string;
  messageOffset: number;
  characterOffset: number;
}

export interface LegacyArchiveMessage {
  id: string;
  sequence: number;
  role: string;
  createdAt: string;
  content: string;
  characterOffset: number;
  complete: boolean;
}

export interface LegacyArchivePage {
  totalLegacyMessages: number;
  matchedMessages: number;
  messages: LegacyArchiveMessage[];
  next?: LegacyArchiveQuery;
}

/** Keeps the original transcript ordered and excludes native exchange projections. */
export function selectLegacyMessages(
  messages: readonly AssistantConversationMessageDoc[],
): AssistantConversationMessageDoc[] {
  return messages
    .filter((message) => !message._id.startsWith('assistant_message_durable_'))
    .sort((left, right) => left.sequence - right.sequence);
}

/** Fits a reversible content slice into a JSON budget without splitting surrogate pairs. */
function contentSlice(content: string, offset: number, budget: number): string {
  const remaining = content.slice(offset);
  if (JSON.stringify(remaining).length <= budget) return remaining;
  let end = offset + Math.max(1, Math.floor((budget - 2) / 6));
  const last = content.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return content.slice(offset, end);
}

function matchingMessages(
  messages: readonly AssistantConversationMessageDoc[],
  query?: string,
): readonly AssistantConversationMessageDoc[] {
  if (!query) return messages;
  const search = query.toLocaleLowerCase();
  return messages.filter((message) => message.content.toLocaleLowerCase().includes(search));
}

function validateCursor(
  messages: readonly AssistantConversationMessageDoc[],
  query: LegacyArchiveQuery,
): void {
  if (
    query.messageOffset > messages.length ||
    query.characterOffset > (messages[query.messageOffset]?.content.length ?? 0)
  )
    throw new Error('Legacy archive cursor is out of range');
}

/** Pages complete archive text with explicit continuation cursors instead of dropping content. */
export function readLegacyArchive(
  source: readonly AssistantConversationMessageDoc[],
  query: LegacyArchiveQuery,
): LegacyArchivePage {
  const legacy = selectLegacyMessages(source);
  const matched = matchingMessages(legacy, query.query);
  validateCursor(matched, query);
  const page: LegacyArchivePage = {
    totalLegacyMessages: legacy.length,
    matchedMessages: matched.length,
    messages: [],
  };
  let index = query.messageOffset;
  let offset = query.characterOffset;
  while (index < matched.length && page.messages.length < MAX_PAGE_MESSAGES) {
    const budget = MAX_PAGE_CHARS - JSON.stringify(page).length - 1800;
    if (budget < 100) break;
    const message = matched[index];
    const content = contentSlice(message.content, offset, budget);
    const complete = offset + content.length >= message.content.length;
    page.messages.push({
      id: message._id,
      sequence: message.sequence,
      role: message.role,
      createdAt: message.createdAt,
      content,
      characterOffset: offset,
      complete,
    });
    if (!complete) {
      offset += content.length;
      break;
    }
    index += 1;
    offset = 0;
  }
  if (index < matched.length)
    page.next = { ...query, messageOffset: index, characterOffset: offset };
  return page;
}
