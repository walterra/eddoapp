import { describe, expect, it } from 'vitest';
import { mergeAssistantHistory } from './assistant_history';
import { assistantThreadMessages } from './assistant_runtime_provider';
import {
  historyPage,
  projectedMessage,
  projectionIds,
  submissionId,
} from './assistant_test_helpers';
import type { AssistantPendingRequest, AssistantSnapshot } from './assistant_types';

function snapshot(): AssistantSnapshot {
  return {
    ...historyPage(),
    loading: false,
    loadingOlder: false,
    submitting: false,
    connection: 'connected',
    pending: null,
    error: null,
  };
}

describe('shared assistant history rendering', () => {
  it('merges stable document IDs without resetting an older pagination cursor', () => {
    const state = {
      ...snapshot(),
      messages: [projectedMessage('user', 1), projectedMessage('assistant', 2)],
      nextCursor: 'older-page',
    };
    const page = {
      ...historyPage(),
      messages: [
        projectedMessage('assistant', 2),
        { ...projectedMessage('assistant', 3), _id: 'new-message' },
      ],
      nextCursor: 'new-latest-cursor',
    };
    const merged = mergeAssistantHistory(state, page, false);
    expect(merged.messages).toHaveLength(3);
    expect(merged.nextCursor).toBe('older-page');
    expect(
      mergeAssistantHistory(state, { ...historyPage(), messages: [] }, true).messages,
    ).toHaveLength(2);
  });

  it('drops stale windows when the active conversation changes or a reconnect leaves a gap', () => {
    const state = { ...snapshot(), messages: [projectedMessage('user', 1)] };
    const later = {
      ...historyPage(),
      messages: [{ ...projectedMessage('assistant', 50), _id: 'later' }],
    };
    expect(mergeAssistantHistory(state, later, false).messages).toHaveLength(1);
    expect(mergeAssistantHistory(state, historyPage('alice'), false).messages).toEqual([]);
    const changed = { ...later, conversation: { ...historyPage().conversation!, _id: 'other' } };
    expect(mergeAssistantHistory(state, changed, false).messages?.[0]._id).toBe('later');
  });

  it('deduplicates optimistic messages by projection identity, never by matching text', () => {
    const pending: AssistantPendingRequest = {
      username: 'alice',
      submissionId,
      text: 'Hello',
      createdAt: '2026-10-29T00:00:00.000Z',
      conversationId: 'active',
      projectionIds,
    };
    expect(
      assistantThreadMessages(
        [{ ...projectedMessage('user', 1), _id: 'another-request' }],
        pending,
        'active',
      ),
    ).toHaveLength(2);
    expect(assistantThreadMessages([projectedMessage('user', 1)], pending, 'active')).toHaveLength(
      1,
    );
    expect(assistantThreadMessages([], pending, 'other')).toHaveLength(0);
  });
});
