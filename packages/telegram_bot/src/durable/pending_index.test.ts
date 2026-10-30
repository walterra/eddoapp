import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { createRegistry, defineExtension, Harness } from '@earendil-works/pi-durable';
import {
  getPendingRequests,
  initializePendingRequests,
} from '@eddo/assistant-server/pending_requests';
import { createRequestTask } from '@eddo/assistant-server/request_task';
import { RequestMap } from '@eddo/assistant-server/state';
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

/** Builds the legacy registry without creating the new pending-work index. */
function registry() {
  const result = createRegistry();
  result.install(
    defineExtension({
      name: 'legacy-test',
      tasks: [
        createRequestTask({
          authorize: async () => {},
          project: async () => {},
          deliver: vi.fn(),
          prepareReply: (_input, answer) => ({ answer, printable: false }),
        }),
      ],
    }),
  );
  return result;
}

describe('pending index journal upgrade', () => {
  it('backfills existing pending task identities before recovery and retains them across reopen', async () => {
    const fixture = await createRuntimeFixture();
    const options = { models: fixture.options.models, registry: registry(), onReport: vi.fn() };
    const harness = await Harness.open(fixture.options.storage, options, context);
    const input = createTestInput();
    try {
      const conversation = await harness.createConversation(
        { ownership: { kind: 'ownerless' }, agent: { model: fixture.options.model } },
        context,
      );
      await conversation.commit(async (tx) => {
        const task = await tx.createTask(
          createRequestTask({
            authorize: async () => {},
            project: async () => {},
            deliver: vi.fn(),
            prepareReply: (_input, answer) => ({ answer, printable: false }),
          }),
          input,
          { ownership: { kind: 'conversation' }, background: true },
        );
        (await tx.doc(RequestMap)).tasks[input.requestId] = task;
      }, context);
      expect((await getPendingRequests(harness)).requests).toEqual([]);
      await initializePendingRequests(harness);
      await initializePendingRequests(harness);
      expect((await getPendingRequests(harness)).requests).toEqual([
        { requestId: input.requestId, conversationId: input.conversationId, status: 'queued' },
      ]);
      expect(fixture.provider.state.callCount).toBe(0);
    } finally {
      await harness.close(context);
    }
    const reopened = await Harness.open((await fixture.reopen()).storage, options, context);
    try {
      expect(
        (await getPendingRequests(reopened)).requests.map((request) => request.requestId),
      ).toEqual([input.requestId]);
      expect(fixture.provider.state.callCount).toBe(0);
    } finally {
      await reopened.close(context);
    }
  });
});
