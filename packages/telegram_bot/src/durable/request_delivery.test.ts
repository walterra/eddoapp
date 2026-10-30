import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { NextTaskState } from '@earendil-works/pi-durable';
import type { RequestRuntime } from '@eddo/assistant-server/request_generation';
import type { RequestCheckpoint } from '@eddo/assistant-server/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverAnswer } from './request_delivery.js';
import type { RequestDependencies } from './request_dependencies.js';
import { createTestInput } from './test_helpers.js';

type DeliveryTask = Parameters<typeof deliverAnswer>[0];
type DeliveryCheckpoint = Extract<RequestCheckpoint, { phase: 'deliver' }>;
type DeliveryState = NextTaskState<RequestCheckpoint, string>;

function fixture(overrides: Partial<DeliveryCheckpoint> = {}) {
  const states: DeliveryState[] = [];
  const checkpoint: DeliveryCheckpoint = {
    phase: 'deliver',
    answer: 'Report',
    offset: 0,
    projected: true,
    attempts: 0,
    ...overrides,
  };
  const task = {
    input: createTestInput({ deadline: 100_000, report: { type: 'recap', occurrence: 'today' } }),
    state: { checkpoint },
  } as DeliveryTask;
  const sleep = vi.fn().mockResolvedValue(undefined);
  const runtime = {
    signal: new AbortController().signal,
    report: vi.fn(),
    sleep,
    commit: async (update: () => DeliveryState) => {
      states.push(update());
    },
  } as unknown as RequestRuntime;
  const dependencies: RequestDependencies = {
    authorize: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    project: vi.fn(),
  };
  return { task, runtime, dependencies, states, sleep };
}

afterEach(() => vi.restoreAllMocks());

describe('bounded delivery checkpoints', () => {
  it('terminates expired reports before sending any chunk', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100_000);
    const test = fixture();
    await deliverAnswer(test.task, test.runtime, BACKGROUND_CONTEXT, test.dependencies);
    expect(test.dependencies.send).not.toHaveBeenCalled();
    expect(test.states[0]).toMatchObject({ status: 'terminal', outcome: { status: 'failed' } });
  });

  it('terminates permanent errors without retrying or printing', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const test = fixture();
    vi.mocked(test.dependencies.send).mockRejectedValue({ error_code: 403 });
    await deliverAnswer(test.task, test.runtime, BACKGROUND_CONTEXT, test.dependencies);
    expect(test.states[0]).toMatchObject({ status: 'terminal', outcome: { status: 'failed' } });
    expect(test.sleep).not.toHaveBeenCalled();
  });

  it('persists retry count and wake time before waiting', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const test = fixture();
    vi.mocked(test.dependencies.send).mockRejectedValue(new Error('Offline'));
    await deliverAnswer(test.task, test.runtime, BACKGROUND_CONTEXT, test.dependencies);
    expect(test.states[0]).toMatchObject({
      status: 'running',
      checkpoint: { attempts: 1, retryAt: 30_000, offset: 0 },
    });
    expect(test.sleep).not.toHaveBeenCalled();
  });

  it('resumes the saved wake time without sending or extending backoff', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const test = fixture({ retryAt: 30_000, attempts: 1 });
    await deliverAnswer(test.task, test.runtime, BACKGROUND_CONTEXT, test.dependencies);
    expect(test.sleep).toHaveBeenCalledWith(30_000, BACKGROUND_CONTEXT);
    expect(test.dependencies.send).not.toHaveBeenCalled();
    expect(test.states[0]).toMatchObject({
      status: 'running',
      checkpoint: { attempts: 1, retryAt: undefined },
    });
  });

  it('terminates the fifth failed send', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const test = fixture({ attempts: 4 });
    vi.mocked(test.dependencies.send).mockRejectedValue(new Error('Offline'));
    await deliverAnswer(test.task, test.runtime, BACKGROUND_CONTEXT, test.dependencies);
    expect(test.states[0]).toMatchObject({ status: 'terminal', outcome: { status: 'failed' } });
  });
});
