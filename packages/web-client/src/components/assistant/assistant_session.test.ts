import type { AssistantRequestStatus } from '@eddo/core-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deferred,
  historyPage,
  projectedMessage,
  sessionFixture,
  submissionId,
} from './assistant_test_helpers';
import { AssistantClientError, type AssistantSession } from './assistant_types';

const sessions: AssistantSession[] = [];
beforeEach(() => localStorage.clear());
afterEach(() => {
  for (const session of sessions.splice(0)) session.stop();
});
async function ready(username = 'alice') {
  const test = sessionFixture(username);
  sessions.push(test.session);
  test.session.start();
  await vi.waitFor(() => expect(test.session.getSnapshot().connection).toBe('connected'));
  return test;
}

describe('shared assistant browser session', () => {
  it('persists the UUID before admission and never starts sandbox lifecycle operations', async () => {
    const test = await ready();
    vi.mocked(test.client.admit).mockImplementation(async (pending) => {
      expect(test.store.read()?.submissionId).toBe(pending.submissionId);
      return test.receipt;
    });
    await test.session.send('Hello');
    expect(test.session.getSnapshot().pending?.receipt).toEqual(test.receipt);
    expect(test.uuid).toHaveBeenCalledOnce();
    expect(test.client.admit).toHaveBeenCalledOnce();
  });

  it('retains unconfirmed work and explicitly retries only the original UUID after status lookup', async () => {
    const test = await ready();
    vi.mocked(test.client.admit)
      .mockRejectedValueOnce(new AssistantClientError('network'))
      .mockResolvedValue(test.receipt);
    await test.session.send('Hello');
    expect(test.store.read()?.receipt).toBeUndefined();
    vi.mocked(test.client.status).mockResolvedValueOnce(null);
    await test.session.retry();
    expect(test.client.status).toHaveBeenCalledWith(`web:alice:${submissionId}`);
    expect(
      vi.mocked(test.client.admit).mock.calls.map(([pending]) => pending.submissionId),
    ).toEqual([submissionId, submissionId]);
    expect(test.uuid).toHaveBeenCalledOnce();
  });

  it('never resubmits admitted work when status is temporarily missing', async () => {
    const test = await ready();
    await test.session.send('Hello');
    vi.mocked(test.client.status).mockResolvedValueOnce(null);
    await test.session.retry();
    expect(test.client.admit).toHaveBeenCalledOnce();
    expect(test.session.getSnapshot().error).toBe('unavailable');
  });

  it('continues admitted HTTP work after sidebar teardown and restores tracking on reopen', async () => {
    const test = await ready();
    const gate = deferred<AssistantRequestStatus>();
    vi.mocked(test.client.admit).mockReturnValue(gate.promise);
    const sending = test.session.send('Hello');
    await vi.waitFor(() => expect(test.client.admit).toHaveBeenCalledOnce());
    test.session.stop();
    expect(test.streams.every((stream) => stream.signal.aborted)).toBe(true);
    gate.resolve(test.receipt);
    await sending;
    expect(test.store.read()?.receipt).toEqual(test.receipt);
    const reopened = await ready();
    expect(reopened.session.getSnapshot().pending?.submissionId).toBe(submissionId);
    expect(reopened.streams[0].requestIds).toEqual([test.receipt.requestId]);
    expect(reopened.client.admit).not.toHaveBeenCalled();
  });

  it('does not resurrect a completed projection when the admission response arrives late', async () => {
    const test = await ready();
    const gate = deferred<AssistantRequestStatus>();
    vi.mocked(test.client.admit).mockReturnValue(gate.promise);
    const sending = test.session.send('Hello');
    await vi.waitFor(() =>
      expect(
        test.streams.some((stream) => stream.requestIds.includes(test.receipt.requestId)),
      ).toBe(true),
    );
    vi.mocked(test.client.history).mockResolvedValue({
      ...historyPage(),
      messages: [projectedMessage('user', 1), projectedMessage('assistant', 2)],
    });
    const live = test.streams[test.streams.length - 1];
    live.onEvent({ event: 'request-status', data: { ...test.receipt, status: 'completed' } });
    await vi.waitFor(() => expect(test.session.getSnapshot().pending).toBeNull());
    gate.resolve(test.receipt);
    await sending;
    expect(test.store.read()).toBeNull();
    expect(test.session.getSnapshot().messages).toHaveLength(2);
  });

  it('never offers automatic mutation replay after a terminal failure', async () => {
    const test = await ready();
    await test.session.send('Hello');
    await vi.waitFor(() =>
      expect(test.streams.some((stream) => stream.requestIds.length)).toBe(true),
    );
    test.streams[test.streams.length - 1].onEvent({
      event: 'request-status',
      data: { ...test.receipt, status: 'failed' },
    });
    await test.session.retry();
    expect(test.client.admit).toHaveBeenCalledOnce();
    expect(test.session.getSnapshot().pending?.receipt?.status).toBe('failed');
    test.session.dismiss();
    expect(test.store.read()).toBeNull();
  });

  it('isolates pending state and cached history between accounts', async () => {
    const alice = await ready();
    await alice.session.send('Private Alice message');
    const bob = await ready('bob');
    expect(bob.session.getSnapshot().pending).toBeNull();
    expect(bob.session.getSnapshot().messages).toEqual([]);
    expect(bob.client.admit).not.toHaveBeenCalled();
    expect(alice.store.read()?.text).toBe('Private Alice message');
  });
});
