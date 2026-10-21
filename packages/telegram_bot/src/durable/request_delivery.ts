import type { Context } from '@earendil-works/chord';
import type { NextTaskState, RunningTask } from '@earendil-works/pi-durable';
import { deliveryDeadline, deliveryRetry, MAX_DELIVERY_FAILURES } from './delivery_policy.js';
import { createProjectionTask } from './projection_task.js';
import { requestOutcome } from './request_failure.js';
import type { RequestRuntime } from './request_generation.js';
import type { RequestDependencies } from './request_task.js';
import type { DurableRequestInput, RequestCheckpoint } from './state.js';

type DeliveryCheckpoint = Extract<RequestCheckpoint, { phase: 'deliver' }>;
type DeliveryTask = RunningTask<DurableRequestInput, DeliveryCheckpoint, string>;

/** Splits plain-text Telegram output without separating UTF-16 surrogate pairs. */
export function telegramChunk(answer: string, offset: number): string {
  let end = Math.min(answer.length, offset + 4000);
  const last = answer.charCodeAt(end - 1);
  if (end < answer.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
  return answer.slice(offset, end);
}

function failedDelivery(failure: string): NextTaskState<RequestCheckpoint, string> {
  return { status: 'terminal', outcome: { status: 'failed', error: { message: failure } } };
}

/** Journals projection admission independently from Telegram delivery. */
async function queueProjection(
  task: DeliveryTask,
  runtime: RequestRuntime,
  context: Context,
  dependencies: RequestDependencies,
): Promise<void> {
  await runtime.commit(async (tx) => {
    await tx.createTask(
      createProjectionTask(dependencies),
      { request: task.input, answer: task.state.checkpoint.answer },
      { ownership: { kind: 'conversation' }, background: true },
    );
    return { status: 'running', checkpoint: { ...task.state.checkpoint, projected: true } };
  }, context);
}

async function recordSendFailure(
  task: DeliveryTask,
  runtime: RequestRuntime,
  context: Context,
  error: unknown,
): Promise<void> {
  if (runtime.signal.aborted) throw error;
  runtime.report(error);
  const checkpoint = task.state.checkpoint;
  const attempts = checkpoint.attempts + 1;
  const retry = deliveryRetry(error, attempts, deliveryDeadline(task.input));
  await runtime.commit(
    () =>
      retry.failure
        ? failedDelivery(retry.failure)
        : { status: 'running', checkpoint: { ...checkpoint, attempts, retryAt: retry.retryAt } },
    context,
  );
}

/** Checks expiry before each chunk and persists backoff before sleeping. */
export async function deliverAnswer(
  task: DeliveryTask,
  runtime: RequestRuntime,
  context: Context,
  dependencies: RequestDependencies,
): Promise<void> {
  await dependencies.authorize(task.input);
  const checkpoint = task.state.checkpoint;
  if (!checkpoint.projected) return queueProjection(task, runtime, context, dependencies);
  if (Date.now() >= deliveryDeadline(task.input) || checkpoint.attempts >= MAX_DELIVERY_FAILURES) {
    await runtime.commit(
      () => failedDelivery('Telegram delivery deadline or retry limit reached.'),
      context,
    );
    return;
  }
  if (checkpoint.retryAt) {
    await runtime.sleep(checkpoint.retryAt, context);
    await runtime.commit(
      () => ({ status: 'running', checkpoint: { ...checkpoint, retryAt: undefined } }),
      context,
    );
    return;
  }
  const chunk = telegramChunk(checkpoint.answer, checkpoint.offset);
  try {
    if (chunk) await dependencies.send(task.input.chatId, chunk);
  } catch (error) {
    return recordSendFailure(task, runtime, context, error);
  }
  const offset = checkpoint.offset + chunk.length;
  await runtime.commit(
    () =>
      offset >= checkpoint.answer.length
        ? deliveryFinished(task)
        : { status: 'running', checkpoint: { ...checkpoint, offset } },
    context,
  );
}

/** Prints reports only after every Telegram chunk has a committed delivery receipt. */
function deliveryFinished(task: DeliveryTask): NextTaskState<RequestCheckpoint, string> {
  const { answer, printable, reportType, failure } = task.state.checkpoint;
  if (task.input.report || reportType)
    return {
      status: 'running',
      checkpoint: {
        phase: 'print',
        answer,
        printable: printable ?? false,
        ...(reportType ? { reportType } : {}),
        ...(failure ? { failure } : {}),
      },
    };
  return { status: 'terminal', outcome: requestOutcome(answer, failure) };
}
