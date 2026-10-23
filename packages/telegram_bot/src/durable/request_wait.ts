import { BACKGROUND_CONTEXT, withAbortSignal } from '@earendil-works/chord/context';
import type { Harness, TaskId } from '@earendil-works/pi-durable';
import { deliveredRequestFailure } from './request_failure.js';

export interface PendingDurableRequest extends Error {
  requestId: string;
  durablePending: true;
}

export interface RequestWaitOptions {
  requestId: string;
  timeoutMs?: number;
}

/** Marks admitted work whose terminal outcome has not been observed by this handler. */
function pendingRequest(requestId: string, cause: unknown): PendingDurableRequest {
  return Object.assign(new Error('Durable request outcome is still pending.', { cause }), {
    name: 'PendingDurableRequest',
    requestId,
    durablePending: true as const,
  });
}

/** Identifies an interrupted wait without treating it as failed durable execution. */
export function isPendingDurableRequest(error: unknown): error is PendingDurableRequest {
  return (
    error instanceof Error &&
    error.name === 'PendingDurableRequest' &&
    'durablePending' in error &&
    error.durablePending === true &&
    'requestId' in error &&
    typeof error.requestId === 'string'
  );
}

/** Bounds only the caller's wait; admitted work retains its own persisted lifecycle. */
export async function waitForRequestResult(
  harness: Pick<Harness, 'waitForTask'>,
  taskId: TaskId<string>,
  options: RequestWaitOptions,
): Promise<string> {
  const wait = withAbortSignal(
    AbortSignal.timeout(options.timeoutMs ?? 360_000),
    BACKGROUND_CONTEXT,
  );
  const task = await harness.waitForTask(taskId, wait).catch((error: unknown) => {
    throw pendingRequest(options.requestId, error);
  });
  if (task.state.outcome.status === 'failed' && task.state.outcome.result !== undefined)
    throw deliveredRequestFailure(task.state.outcome.error.message);
  if (task.state.outcome.status !== 'completed')
    throw new Error(`Durable request ${task.state.outcome.status}`);
  return task.state.outcome.result;
}
