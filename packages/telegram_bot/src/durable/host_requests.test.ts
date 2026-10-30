import { InternalAssistantError } from '@eddo/assistant-server/internal_protocol';
import { AssistantRequestConflictError } from '@eddo/assistant-server/request_identity';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantAuthorizationError } from './account_authorization.js';
import { createWebHostOperations } from './host_requests.js';

const authorization = vi.hoisted(() => vi.fn());
vi.mock('./account_authorization.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./account_authorization.js')>()),
  resolveAssistantAccount: authorization,
}));

const input = {
  username: 'alice',
  requestId: '70f72756-993e-4cae-8108-f6b723391ae1',
  text: 'List tasks',
};

function fixture() {
  const receipt = {
    requestId: `web:alice:${input.requestId}`,
    conversationId: 'original',
    status: 'queued' as const,
  };
  const runtime: DurableRuntime = {
    enqueue: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn(),
    close: vi.fn(),
    closed: Promise.resolve({ reason: 'closed' }),
    getPendingRequests: vi.fn().mockResolvedValue({ requests: [], hasMore: false }),
    getRequestStatus: vi.fn().mockResolvedValue(receipt),
  };
  const dependencies = {
    runtime: vi.fn().mockResolvedValue(runtime),
    conversationId: vi.fn().mockResolvedValue('active'),
  };
  return { runtime, dependencies, operations: createWebHostOperations(dependencies), receipt };
}

beforeEach(() => {
  authorization.mockReset();
  authorization.mockResolvedValue({ username: 'alice', mcpApiKey: 'current' });
});

describe('web admission into the existing assistant owner', () => {
  it('discovers channel-neutral pending work only after fresh account authorization', async () => {
    const test = fixture();
    const page = { requests: [{ ...test.receipt, requestId: 'telegram:bot:1' }], hasMore: false };
    vi.mocked(test.runtime.getPendingRequests).mockResolvedValue(page);
    expect(await test.operations.pending({ username: 'alice' })).toEqual(page);
    expect(test.dependencies.runtime).toHaveBeenCalledWith('alice');
    authorization.mockRejectedValue(new AssistantAuthorizationError('revoked'));
    await expect(test.operations.pending({ username: 'alice' })).rejects.toMatchObject({
      status: 403,
    });
    expect(test.runtime.getPendingRequests).toHaveBeenCalledOnce();
  });
  it('resolves routing and timing on the server and returns original deduplicated identity', async () => {
    const test = fixture();
    expect(await test.operations.admit(input)).toEqual(test.receipt);
    expect(test.runtime.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        account: { username: 'alice' },
        requestId: test.receipt.requestId,
        conversationId: 'active',
        source: { channel: 'web' },
        text: input.text,
        createdAt: expect.any(String),
        deadline: expect.any(Number),
      }),
    );
    expect(test.dependencies.runtime).toHaveBeenCalledExactlyOnceWith('alice');
    expect(test.runtime.execute).not.toHaveBeenCalled();
  });

  it('revalidates authorization on every status query and rejects cross-account identities', async () => {
    const test = fixture();
    await expect(
      test.operations.status({ username: 'bob', requestId: test.receipt.requestId }),
    ).rejects.toMatchObject({ status: 403 });
    expect(test.dependencies.runtime).not.toHaveBeenCalled();
    expect(
      await test.operations.status({ username: 'alice', requestId: test.receipt.requestId }),
    ).toEqual(test.receipt);
    authorization.mockRejectedValue(new AssistantAuthorizationError('revoked'));
    await expect(
      test.operations.status({ username: 'alice', requestId: test.receipt.requestId }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects revoked admission without opening a runtime or resolving conversation state', async () => {
    const test = fixture();
    authorization.mockRejectedValue(new AssistantAuthorizationError('revoked'));
    await expect(test.operations.admit(input)).rejects.toBeInstanceOf(InternalAssistantError);
    expect(test.dependencies.runtime).not.toHaveBeenCalled();
    expect(test.dependencies.conversationId).not.toHaveBeenCalled();
  });

  it('preserves payload conflicts and infrastructure outages as distinct service failures', async () => {
    const test = fixture();
    vi.mocked(test.runtime.enqueue).mockRejectedValue(new AssistantRequestConflictError('changed'));
    await expect(test.operations.admit(input)).rejects.toMatchObject({
      status: 409,
      code: 'request_conflict',
    });
    authorization.mockRejectedValue(new Error('Registry outage'));
    await expect(test.operations.admit(input)).rejects.toThrow('Registry outage');
  });
});
