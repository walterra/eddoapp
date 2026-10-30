import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssistantPendingStore } from './assistant_pending';
import { createAssistantSession } from './assistant_session';
import { projectionIds, sessionFixture, submissionId } from './assistant_test_helpers';
import type { AssistantPendingRequest } from './assistant_types';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function pending(username = 'alice'): AssistantPendingRequest {
  return {
    username,
    submissionId,
    text: 'Hello',
    createdAt: '2026-10-29T00:00:00.000Z',
    conversationId: null,
    projectionIds,
  };
}

describe('account-scoped pending request recovery', () => {
  it('keeps accounts separate and refuses identity mismatches', () => {
    const alice = createAssistantPendingStore('alice', localStorage);
    const bob = createAssistantPendingStore('bob', localStorage);
    alice.write(pending());
    expect(bob.read()).toBeNull();
    expect(() => alice.write(pending('bob'))).toThrow('storage');
    alice.clear('another-id');
    expect(alice.read()?.submissionId).toBe(submissionId);
  });

  it('does not silently discard corrupted or conflicting pending state', () => {
    const store = createAssistantPendingStore('alice', localStorage);
    localStorage.setItem('eddo.assistant.pending.v1.alice', '{bad-json');
    expect(() => store.read()).toThrow('storage');
    expect(localStorage.getItem('eddo.assistant.pending.v1.alice')).toBe('{bad-json');
    localStorage.clear();
    store.write(pending());
    expect(() =>
      store.write({ ...pending(), submissionId: '33669aa0-d9ba-4d66-b2ab-9081206bad57' }),
    ).toThrow('storage');
  });

  it('requires browser cryptography before creating or sending a request', async () => {
    const test = sessionFixture();
    vi.stubGlobal('crypto', undefined);
    const session = createAssistantSession({
      username: 'alice',
      client: test.client,
      pendingStore: test.store,
    });
    session.start();
    try {
      await vi.waitFor(() => expect(session.getSnapshot().connection).toBe('connected'));
      await session.send('Hello');
      expect(session.getSnapshot().error).toBe('unsupported');
      expect(test.client.admit).not.toHaveBeenCalled();
      expect(test.store.read()).toBeNull();
    } finally {
      session.stop();
    }
  });

  it('fails closed before admission when UUID persistence is unavailable', async () => {
    const test = sessionFixture();
    test.session.start();
    try {
      await vi.waitFor(() => expect(test.session.getSnapshot().connection).toBe('connected'));
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
      await test.session.send('Hello');
      expect(test.client.admit).not.toHaveBeenCalled();
      expect(test.session.getSnapshot().error).toBe('storage');
    } finally {
      test.session.stop();
    }
  });
});
