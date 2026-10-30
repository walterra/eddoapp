import type {
  AssistantConversationMessageDoc,
  AssistantHistoryPage,
  AssistantRequestStatus,
} from '@eddo/core-shared';
import { vi } from 'vitest';
import { createAssistantPendingStore } from './assistant_pending';
import { createAssistantSession } from './assistant_session';
import type { AssistantBrowserClient, AssistantStreamRequest } from './assistant_types';

export const submissionId = '70f72756-993e-4cae-8108-f6b723391ae1';
export const projectionIds = {
  user: `assistant_message_durable_${'a'.repeat(64)}_user`,
  assistant: `assistant_message_durable_${'a'.repeat(64)}_assistant`,
};
export function historyPage(username = 'alice'): AssistantHistoryPage {
  return {
    conversation: {
      _id: 'active',
      version: 'assistant_conversation_alpha1',
      username,
      active: true,
      createdAt: '2026-10-29T00:00:00Z',
      updatedAt: '2026-10-29T00:00:00Z',
      stats: { messageCount: 0, userMessageCount: 0, assistantMessageCount: 0 },
    },
    messages: [],
    nextCursor: null,
    changeCursor: 'checkpoint-12',
  };
}
export function projectedMessage(
  role: 'user' | 'assistant',
  sequence: number,
): AssistantConversationMessageDoc {
  return {
    _id: projectionIds[role],
    version: 'assistant_conversation_message_alpha1',
    conversationId: 'active',
    role,
    content: role === 'user' ? 'Hello' : 'Shared reply',
    channel: 'web',
    createdAt: '2026-10-29T00:00:00Z',
    sequence,
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
export function sessionFixture(username = 'alice') {
  const receipt: AssistantRequestStatus = {
    requestId: `web:${username}:${submissionId}`,
    conversationId: 'active',
    status: 'queued',
  };
  const streams: AssistantStreamRequest[] = [];
  const client: AssistantBrowserClient = {
    history: vi.fn().mockResolvedValue(historyPage(username)),
    admit: vi.fn().mockResolvedValue(receipt),
    status: vi.fn().mockResolvedValue(receipt),
    stream: vi.fn<AssistantBrowserClient['stream']>().mockImplementation(async (request) => {
      streams.push(request);
      request.onConnected();
      await new Promise<void>((_resolve, reject) => {
        if (request.signal.aborted) reject(request.signal.reason);
        else
          request.signal.addEventListener('abort', () => reject(request.signal.reason), {
            once: true,
          });
      });
    }),
  };
  const store = createAssistantPendingStore(username, localStorage);
  const uuid = vi.fn(() => submissionId);
  const session = createAssistantSession({
    username,
    client,
    pendingStore: store,
    uuid,
    projectionIds: async () => projectionIds,
  });
  return { session, client, store, streams, receipt, uuid };
}
