import type { Context } from '@earendil-works/chord';
import type { RunningTask } from '@earendil-works/pi-durable';
import { commitRequestState } from './request_commit.js';
import { requestOutcome } from './request_failure.js';
import type { RequestRuntime } from './request_generation.js';
import type { RequestDependencies } from './request_task.js';
import type { RequestCheckpoint, RuntimeRequestInput } from './state.js';

type ProjectionTask = RunningTask<
  RuntimeRequestInput,
  Extract<RequestCheckpoint, { phase: 'project' }>,
  string
>;

/** Completes only after history persists; retries never repeat Telegram delivery. */
export async function projectRequest(
  task: ProjectionTask,
  runtime: RequestRuntime,
  context: Context,
  dependencies: Pick<RequestDependencies, 'authorize' | 'project'>,
): Promise<void> {
  const checkpoint = task.state.checkpoint;
  if (checkpoint.retryAt) await runtime.sleep(checkpoint.retryAt, context);
  await dependencies.authorize(task.input);
  try {
    await dependencies.project(task.input, checkpoint.answer);
  } catch (error) {
    if (runtime.signal.aborted) throw error;
    runtime.report(error);
    await runtime.commit(
      () => ({
        status: 'running',
        checkpoint: { ...checkpoint, retryAt: Date.now() + 30_000 },
      }),
      context,
    );
    return;
  }
  await commitRequestState(
    runtime,
    () => ({
      status: 'terminal',
      outcome: requestOutcome(checkpoint.answer, checkpoint.failure),
    }),
    context,
  );
}
