import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { LiveDoc, type Harness, type TaskId } from '@earendil-works/pi-durable';
import type { AssistantRequestStatus } from '@eddo/core-shared';
import { getRequestStatus } from './request_status.js';
import { RequestCancellations, RequestMap } from './state.js';

type RequestTask = NonNullable<Awaited<ReturnType<Harness['getTask']>>>;
interface AbortTargets {
  request?: TaskId;
  generation?: TaskId;
}

function terminal(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'aborted';
}

/** Signals only this request and the native run that owns its input, never another queued request. */
async function markAbort(harness: Harness, requestId: string): Promise<AbortTargets> {
  const taskId = (await harness.snapshot(RequestMap, context))?.tasks[requestId];
  if (taskId === undefined) return {};
  const task = await harness.getTask(taskId, context);
  if (!task) throw new Error('Cancellation request mapping is invalid');
  await harness.abortTask(taskId, context);
  return { request: taskId, generation: await markGeneration(harness, task, requestId) };
}

/** Withdraws queued inputs or aborts the specific placed input's active native run. */
async function markGeneration(
  harness: Harness,
  task: RequestTask,
  requestId: string,
): Promise<TaskId | undefined> {
  const submission = await harness.commit(
    (tx) => tx.submissionByRequest(task.conversationId, requestId),
    context,
  );
  if (!submission || submission.status === 'done' || submission.status === 'unanswered') return;
  const result = await harness.abortSubmission(submission.id, context, task.conversationId);
  if (result !== 'already_placed') return;
  const live = await harness.snapshot(LiveDoc, task.conversationId, context);
  if (!live?.run?.inputs.includes(submission.id)) return;
  if (live.run.inputs.length !== 1)
    throw new Error('Cannot cancel an input shared by another native request');
  await harness.abortTask(live.run.taskId, context);
  return live.run.taskId;
}

/** Waits for native abort handlers, retrying a generation handoff without cancelling unrelated work. */
async function settleAbort(harness: Harness, requestId: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const targets = await markAbort(harness, requestId);
    if (targets.request !== undefined) await harness.waitForTask(targets.request, context);
    if (targets.generation !== undefined) await harness.waitForTask(targets.generation, context);
    const task =
      targets.request === undefined ? undefined : await harness.getTask(targets.request, context);
    const submission = task
      ? await harness.commit(
          (tx) => tx.submissionByRequest(task.conversationId, requestId),
          context,
        )
      : undefined;
    if (!submission || submission.status === 'done' || submission.status === 'unanswered') return;
  }
  throw new Error('Native cancellation has not settled');
}

/** Advances already accepted inbox inputs after native abort stops automatic draining; adds no user input or model text. */
async function resumeQueue(harness: Harness, requestId: string): Promise<void> {
  const taskId = (await harness.snapshot(RequestMap, context))?.tasks[requestId];
  if (taskId === undefined) return;
  const task = await harness.getTask(taskId, context);
  if (!task) throw new Error('Cancellation request mapping is invalid');
  const conversation = await harness.conversation(task.conversationId, context);
  if (!conversation) throw new Error('Cancellation conversation is missing');
  await conversation.submit(
    {
      type: 'write',
      requestId: `${requestId}:cancelled`,
      entry: { kind: 'eddo.request-cancellation', data: { requestId }, model: [] },
    },
    context,
  );
}

/** Persists cancellation before acknowledging it, including identities not admitted yet. */
export async function cancelRequest(
  harness: Harness,
  requestId: string,
  conversationId: string,
): Promise<AssistantRequestStatus> {
  const previous = await getRequestStatus(harness, requestId);
  const cancellation = (await harness.snapshot(RequestCancellations, context))?.requests[requestId];
  if (previous && terminal(previous.status) && !cancellation) return previous;
  if (!cancellation) {
    await harness.commit(async (tx) => {
      (await tx.doc(RequestCancellations)).requests[requestId] = {
        conversationId: previous?.conversationId ?? conversationId,
        confirmed: false,
      };
    }, context);
  }
  await settleAbort(harness, requestId);
  await resumeQueue(harness, requestId);
  await harness.commit(async (tx) => {
    (await tx.doc(RequestCancellations)).requests[requestId].confirmed = true;
  }, context);
  const result = await getRequestStatus(harness, requestId);
  if (!result) throw new Error('Cancellation receipt is missing');
  return result;
}

/** Marks interrupted cancellation targets before the Harness resumes recovered task execution. */
export async function prepareCancellations(harness: Harness): Promise<string[]> {
  const entries = Object.entries(
    (await harness.snapshot(RequestCancellations, context))?.requests ?? {},
  );
  const pending = entries.filter(([, value]) => !value.confirmed).map(([id]) => id);
  for (const id of pending) await markAbort(harness, id);
  return pending;
}
