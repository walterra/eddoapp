import type { AssistantRequestStatus } from '@eddo/core-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAssistantBrowserClient } from './assistant_api';
import { deferred, sessionFixture, submissionId } from './assistant_test_helpers';
import { AssistantClientError, type AssistantSession } from './assistant_types';

const sessions: AssistantSession[] = [];
beforeEach(() => localStorage.clear());
afterEach(() => {
  sessions.splice(0).forEach((session) => session.stop());
  vi.restoreAllMocks();
});
async function fixture() {
  const test = sessionFixture();
  sessions.push(test.session);
  test.session.start();
  await vi.waitFor(() => expect(test.session.getSnapshot().loading).toBe(false));
  return test;
}

describe('explicit assistant cancellation', () => {
  it('cancels missing admission without retrying the original message', async () => {
    const test = await fixture();
    vi.mocked(test.client.admit).mockRejectedValueOnce(new AssistantClientError('unavailable'));
    await test.session.send('Unconfirmed message');
    expect(test.store.read()?.receipt).toBeUndefined();
    await test.session.cancel();
    expect(test.client.cancel).toHaveBeenCalledExactlyOnceWith(test.receipt.requestId);
    expect(test.client.admit).toHaveBeenCalledOnce();
    expect(test.client.status).not.toHaveBeenCalled();
    expect(test.store.read()).toBeNull();
    expect(test.session.getSnapshot()).toMatchObject({
      pending: null,
      cancelling: false,
      submitting: false,
    });
  });

  it.each([false, true])(
    'removes cancelled activity without hiding other shared work: %s',
    async (otherWork) => {
      const test = await fixture();
      await test.session.send('Hello');
      await vi.waitFor(() => expect(test.session.getSnapshot().connection).toBe('connected'));
      const others: AssistantRequestStatus[] = otherWork
        ? [{ requestId: 'telegram:123:1', conversationId: 'active', status: 'working' }]
        : [];
      test.streams[test.streams.length - 1].onEvent({
        event: 'pending-requests',
        data: { requests: [test.receipt, ...others], hasMore: false },
      });
      expect(test.session.getSnapshot().sharedRequests).toHaveLength(1 + others.length);
      await test.session.cancel();
      expect(test.session.getSnapshot().sharedRequests).toEqual(others);
      expect(test.session.getSnapshot().pending).toBeNull();
    },
  );

  it('retains the identity and blocks replay and new sends until cancellation is confirmed', async () => {
    const test = await fixture();
    await test.session.send('Hello');
    const gate = deferred<AssistantRequestStatus>();
    vi.mocked(test.client.cancel).mockReturnValue(gate.promise);
    const cancellation = test.session.cancel();
    expect(test.store.read()).toMatchObject({ submissionId, cancelRequested: true });
    expect(test.session.getSnapshot().cancelling).toBe(true);
    await test.session.send('Do not send');
    await test.session.retry();
    await test.session.cancel();
    expect(test.client.admit).toHaveBeenCalledOnce();
    expect(test.client.cancel).toHaveBeenCalledOnce();
    expect(test.client.status).not.toHaveBeenCalled();
    gate.resolve({ ...test.receipt, status: 'aborted' });
    await cancellation;
    expect(test.store.read()).toBeNull();
  });

  it('restores failed cancellation intent and retries cancellation rather than admission after reload', async () => {
    const first = await fixture();
    vi.mocked(first.client.admit).mockRejectedValueOnce(new AssistantClientError('unavailable'));
    await first.session.send('Hello');
    vi.mocked(first.client.cancel).mockRejectedValueOnce(new AssistantClientError('network'));
    await first.session.cancel();
    expect(first.store.read()).toMatchObject({ submissionId, cancelRequested: true });
    first.session.stop();
    const second = await fixture();
    await second.session.retry();
    expect(second.client.cancel).toHaveBeenCalledExactlyOnceWith(first.receipt.requestId);
    expect(second.client.admit).not.toHaveBeenCalled();
    expect(second.client.status).not.toHaveBeenCalled();
    expect(second.store.read()).toBeNull();
  });

  it.each(['network', 'forbidden', 'unavailable'] as const)(
    'retains cancellation intent on %s errors',
    async (code) => {
      const test = await fixture();
      await test.session.send('Hello');
      vi.mocked(test.client.cancel).mockRejectedValueOnce(new AssistantClientError(code));
      await test.session.cancel();
      expect(test.store.read()).toMatchObject({ submissionId, cancelRequested: true });
      expect(test.session.getSnapshot()).toMatchObject({ error: code, cancelling: false });
    },
  );

  it.each([{ status: 'working' }, { status: 'aborted', requestId: 'web:bob:foreign' }])(
    'rejects unconfirmed or mismatched cancellation receipts',
    async (invalid) => {
      const test = await fixture();
      await test.session.send('Hello');
      vi.mocked(test.client.cancel).mockResolvedValueOnce({
        ...test.receipt,
        ...invalid,
      } as AssistantRequestStatus);
      await test.session.cancel();
      expect(test.session.getSnapshot().error).toBe('protocol');
      expect(test.store.read()).toMatchObject({ submissionId, cancelRequested: true });
    },
  );

  it('ignores a late admission response without clobbering a newer submission', async () => {
    const test = await fixture();
    const original = deferred<AssistantRequestStatus>();
    vi.mocked(test.client.admit).mockReturnValueOnce(original.promise);
    const first = test.session.send('First');
    await vi.waitFor(() => expect(test.client.admit).toHaveBeenCalledOnce());
    await test.session.cancel();
    expect(test.session.getSnapshot().submitting).toBe(false);
    const nextId = '80f72756-993e-4cae-8108-f6b723391ae2';
    test.uuid.mockReturnValue(nextId);
    const next = deferred<AssistantRequestStatus>();
    vi.mocked(test.client.admit).mockReturnValueOnce(next.promise);
    const second = test.session.send('Second');
    await vi.waitFor(() => expect(test.client.admit).toHaveBeenCalledTimes(2));
    original.resolve({ ...test.receipt, status: 'working' });
    await first;
    expect(test.session.getSnapshot()).toMatchObject({
      submitting: true,
      pending: { submissionId: nextId },
      error: null,
    });
    next.resolve({ ...test.receipt, requestId: `web:alice:${nextId}` });
    await second;
    expect(test.store.read()?.submissionId).toBe(nextId);
    expect(test.session.getSnapshot().submitting).toBe(false);
  });

  it('does not send cancellation when its intent cannot be persisted', async () => {
    const test = await fixture();
    await test.session.send('Hello');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    await test.session.cancel();
    expect(test.client.cancel).not.toHaveBeenCalled();
    expect(test.session.getSnapshot()).toMatchObject({ error: 'storage', cancelling: false });
    expect(test.session.getSnapshot().pending?.submissionId).toBe(submissionId);
  });
});

describe('browser cancellation transport', () => {
  it('uses authenticated POST with a timeout and validates the exact durable identity', async () => {
    const id = `web:alice:${submissionId}`;
    const receipt: AssistantRequestStatus = {
      requestId: id,
      conversationId: 'active',
      status: 'aborted',
    };
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(receipt));
    const client = createAssistantBrowserClient({
      username: 'alice',
      token: 'jwt',
      fetch: transport,
    });
    expect(await client.cancel(id)).toEqual(receipt);
    expect(transport).toHaveBeenCalledWith(
      `/api/assistant/requests/${encodeURIComponent(id)}/cancel`,
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
        cache: 'no-store',
        redirect: 'error',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt' }),
      }),
    );
    transport.mockResolvedValueOnce(Response.json({ ...receipt, requestId: 'web:bob:foreign' }));
    await expect(client.cancel(id)).rejects.toMatchObject({ code: 'protocol' });
  });
});
