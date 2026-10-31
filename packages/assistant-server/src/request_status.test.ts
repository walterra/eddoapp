import type { Harness, Tx } from '@earendil-works/pi-durable';
import type { AssistantRequestState } from '@eddo/core-shared';
import { describe, expect, it, vi } from 'vitest';
import { getRequestStatus } from './request_status.js';

type Task = NonNullable<Awaited<ReturnType<Tx['task']>>>;
interface StatusCase {
  state: Task['state'];
  status: AssistantRequestState;
}
const cases: StatusCase[] = [
  {
    state: { status: 'terminal', outcome: { status: 'completed', result: 'private answer' } },
    status: 'completed',
  },
  {
    state: {
      status: 'terminal',
      outcome: { status: 'failed', error: { message: 'private error' } },
    },
    status: 'failed',
  },
  {
    state: {
      status: 'terminal',
      outcome: { status: 'faulted', error: { message: 'private error' } },
    },
    status: 'failed',
  },
  {
    state: { status: 'terminal', outcome: { status: 'orphaned', reason: 'private reason' } },
    status: 'failed',
  },
  { state: { status: 'terminal', outcome: { status: 'aborted' } }, status: 'aborted' },
  { state: { status: 'pending', checkpoint: { phase: 'generate' } }, status: 'queued' },
  { state: { status: 'running', checkpoint: { phase: 'generate' } }, status: 'working' },
  { state: { status: 'running', checkpoint: { phase: 'deliver' } }, status: 'delivering' },
  { state: { status: 'running', checkpoint: { phase: 'print' } }, status: 'delivering' },
  { state: { status: 'running', checkpoint: { phase: 'project' } }, status: 'projecting' },
];

function harness(state: Task['state']): Harness {
  const tx = {
    task: vi.fn().mockResolvedValue({ input: { conversationId: 'active' }, state }),
    submissionByRequest: vi.fn().mockResolvedValue(undefined),
  };
  return {
    snapshot: vi.fn().mockResolvedValue({ tasks: { request: 1 } }),
    commit: vi
      .fn()
      .mockImplementation((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  } as unknown as Harness;
}

describe('bounded durable request status', () => {
  it.each(cases)(
    'maps native state to $status without private contents',
    async ({ state, status }) => {
      const result = await getRequestStatus(harness(state), 'request');
      expect(result).toEqual({ requestId: 'request', conversationId: 'active', status });
      expect(JSON.stringify(result)).not.toContain('private');
    },
  );
});
