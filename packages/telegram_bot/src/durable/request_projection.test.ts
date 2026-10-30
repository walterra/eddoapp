import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { NextTaskState } from '@earendil-works/pi-durable';
import type { RequestRuntime } from '@eddo/assistant-server/request_generation';
import { projectRequest } from '@eddo/assistant-server/request_projection';
import type { RequestCheckpoint } from '@eddo/assistant-server/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestDependencies } from './request_dependencies.js';
import { createTestInput } from './test_helpers.js';

type ProjectionTask = Parameters<typeof projectRequest>[0];
type ProjectionCheckpoint = Extract<RequestCheckpoint, { phase: 'project' }>;
type ProjectionState = NextTaskState<RequestCheckpoint, string>;

function fixture(overrides: Partial<ProjectionCheckpoint> = {}) {
  const states: ProjectionState[] = [];
  const checkpoint: ProjectionCheckpoint = { phase: 'project', answer: 'Saved', ...overrides };
  const task = { input: createTestInput(), state: { checkpoint } } as ProjectionTask;
  const runtime = {
    signal: new AbortController().signal,
    report: vi.fn(),
    sleep: vi.fn().mockResolvedValue(undefined),
    commit: async (update: () => ProjectionState) => {
      states.push(update());
    },
  } as unknown as RequestRuntime;
  const dependencies: RequestDependencies = {
    authorize: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    project: vi.fn().mockResolvedValue(undefined),
  };
  return { task, runtime, dependencies, states };
}

afterEach(() => vi.restoreAllMocks());

describe('persisted history completion', () => {
  it('checkpoints retry time without completing or repeating delivery', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const test = fixture();
    vi.mocked(test.dependencies.project).mockRejectedValue(new Error('Offline'));
    await projectRequest(test.task, test.runtime, BACKGROUND_CONTEXT, test.dependencies);
    expect(test.states).toEqual([
      {
        status: 'running',
        checkpoint: { phase: 'project', answer: 'Saved', retryAt: 31_000 },
      },
    ]);
    expect(test.runtime.report).toHaveBeenCalledOnce();
    expect(test.runtime.sleep).not.toHaveBeenCalled();
    expect(test.dependencies.send).not.toHaveBeenCalled();
  });

  it('resumes persisted backoff and completes only after projection succeeds', async () => {
    const test = fixture({ retryAt: 31_000 });
    await projectRequest(test.task, test.runtime, BACKGROUND_CONTEXT, test.dependencies);
    expect(test.runtime.sleep).toHaveBeenCalledWith(31_000, BACKGROUND_CONTEXT);
    expect(test.dependencies.project).toHaveBeenCalledWith(test.task.input, 'Saved');
    expect(test.states).toEqual([
      {
        status: 'terminal',
        outcome: { status: 'completed', result: 'Saved' },
      },
    ]);
    expect(test.dependencies.send).not.toHaveBeenCalled();
  });

  it('revalidates authorization before resumed history writes', async () => {
    const test = fixture();
    vi.mocked(test.dependencies.authorize).mockRejectedValue(new Error('Revoked'));
    await expect(
      projectRequest(test.task, test.runtime, BACKGROUND_CONTEXT, test.dependencies),
    ).rejects.toThrow('Revoked');
    expect(test.dependencies.project).not.toHaveBeenCalled();
    expect(test.states).toEqual([]);
  });

  it('preserves failed generation outcomes after history persists', async () => {
    const test = fixture({ failure: 'Generation failed' });
    await projectRequest(test.task, test.runtime, BACKGROUND_CONTEXT, test.dependencies);
    expect(test.states[0]).toMatchObject({
      status: 'terminal',
      outcome: { status: 'failed', error: { message: 'Generation failed' } },
    });
  });
});
