import type { Context } from '@earendil-works/chord';
import type { RequestRuntime } from '@eddo/assistant-server/request_generation';
import type { RequestDeliveryTask } from '@eddo/assistant-server/request_task';
import type { RequestDependencies } from './request_dependencies.js';

/** Preserves replies in shared history even when Telegram delivery later fails. */
export async function projectReplyBeforeDelivery(
  task: RequestDeliveryTask,
  runtime: RequestRuntime,
  context: Context,
  dependencies: RequestDependencies,
): Promise<boolean> {
  const checkpoint = task.state.checkpoint;
  if (!dependencies.projectAccepted || checkpoint.projected) return false;
  if (checkpoint.retryAt && checkpoint.retryAt > Date.now()) {
    await runtime.sleepUntil(checkpoint.retryAt, checkpoint, context);
    return true;
  }
  await dependencies.authorize(task.input);
  try {
    await dependencies.project(task.input, checkpoint.answer);
  } catch (error) {
    if (runtime.signal.aborted) throw error;
    runtime.report(error);
    await runtime.commit(
      () => ({ status: 'running', checkpoint: { ...checkpoint, retryAt: Date.now() + 30_000 } }),
      context,
    );
    return true;
  }
  await runtime.commit(
    () => ({
      status: 'running',
      checkpoint: { ...checkpoint, projected: true, retryAt: undefined },
    }),
    context,
  );
  return true;
}
