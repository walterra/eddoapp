import type { AssistantHistoryPage, AssistantRequestStatus } from '@eddo/core-shared';
import { vi } from 'vitest';
import { changeCursor } from './assistant_cursors';
import type { AssistantService } from './assistant_types';

export const submissionId = '70f72756-993e-4cae-8108-f6b723391ae1';
export const durableRequestId = `web:alice:${submissionId}`;
export const receipt: AssistantRequestStatus = {
  requestId: durableRequestId,
  conversationId: 'active',
  status: 'queued',
};
export const emptyHistory: AssistantHistoryPage = {
  conversation: null,
  messages: [],
  nextCursor: null,
  changeCursor: changeCursor('alice', '0'),
};

export function assistantServiceFixture(): AssistantService {
  return {
    authorize: vi.fn().mockResolvedValue(undefined),
    host: { admit: vi.fn().mockResolvedValue(receipt), status: vi.fn().mockResolvedValue(receipt) },
    store: {
      history: vi.fn().mockResolvedValue(emptyHistory),
      watermark: vi.fn().mockResolvedValue('0'),
      changes: vi
        .fn<AssistantService['store']['changes']>()
        .mockImplementation(async (_username, since, signal) => {
          await new Promise<void>((_resolve, reject) => {
            if (signal.aborted) reject(signal.reason);
            else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          });
          return { changes: [], lastSequence: since };
        }),
    },
  };
}
