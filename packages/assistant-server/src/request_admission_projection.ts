import type { Context } from '@earendil-works/chord';
import type { RunningTask } from '@earendil-works/pi-durable';
import type { RequestRuntime } from './request_generation.js';
import type { RequestCheckpoint, RuntimeRequestInput } from './state.js';

type AdmissionTask = RunningTask<
  RuntimeRequestInput,
  Extract<RequestCheckpoint, { phase: 'generate' }>,
  string
>;
type ProjectAccepted = (input: RuntimeRequestInput) => Promise<void>;

/** Persists accepted text before generation and retries only the idempotent projection. */
export async function projectAcceptedRequest(
  task: AdmissionTask,
  runtime: RequestRuntime,
  context: Context,
  project: ProjectAccepted,
): Promise<void> {
  const checkpoint = task.state.checkpoint;
  try {
    await project(task.input);
  } catch (error) {
    if (runtime.signal.aborted) throw error;
    runtime.report(error);
    await runtime.commit(
      () => ({ status: 'running', checkpoint: { ...checkpoint, retryAt: Date.now() + 30_000 } }),
      context,
    );
    return;
  }
  await runtime.commit(
    () => ({
      status: 'running',
      checkpoint: {
        phase: 'generate',
        accepted: true,
        ...(checkpoint.attempt ? { attempt: checkpoint.attempt } : {}),
      },
    }),
    context,
  );
}
