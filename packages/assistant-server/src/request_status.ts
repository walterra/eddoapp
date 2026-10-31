import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import type { Harness, Tx } from '@earendil-works/pi-durable';
import type { AssistantRequestState, AssistantRequestStatus } from '@eddo/core-shared';
import { RequestMap } from './state.js';

type PersistedTask = NonNullable<Awaited<ReturnType<Tx['task']>>>;

/** Maps native outcomes to bounded public states without exposing raw error messages. */
function outcomeState(
  state: Extract<PersistedTask['state'], { status: 'terminal' | 'completing' }>,
): AssistantRequestState {
  switch (state.outcome.status) {
    case 'completed':
      return 'completed';
    case 'aborted':
      return 'aborted';
    case 'failed':
    case 'faulted':
    case 'orphaned':
      return 'failed';
    default: {
      const unexpected: never = state.outcome;
      throw new Error(`Unknown task outcome: ${String(unexpected)}`);
    }
  }
}

/** Reads a phase only from object-shaped persisted checkpoints. */
function checkpointPhase(checkpoint: unknown): string | undefined {
  if (!checkpoint || typeof checkpoint !== 'object' || !('phase' in checkpoint)) return undefined;
  return typeof checkpoint.phase === 'string' ? checkpoint.phase : undefined;
}

/** Maps live checkpoints separately from terminal outcomes. */
function requestState(task: PersistedTask, queued: boolean): AssistantRequestState {
  const state = task.state;
  if (state.status === 'terminal' || state.status === 'completing') return outcomeState(state);
  if (queued) return 'queued';
  const phase = checkpointPhase(state.checkpoint);
  if (phase === 'project') return 'projecting';
  if (phase === 'deliver' || phase === 'print') return 'delivering';
  return state.status === 'pending' ? 'queued' : 'working';
}

/** Reads request identity and lifecycle from the existing owner, including after recovery. */
export async function getRequestStatus(
  harness: Harness,
  requestId: string,
): Promise<AssistantRequestStatus | null> {
  const mapping = await harness.snapshot(RequestMap, context);
  const id = mapping?.tasks[requestId];
  if (id === undefined) return null;
  const { task, queued } = await harness.commit(async (tx) => {
    const task = await tx.task(id);
    const submission = task
      ? await tx.submissionByRequest(task.conversationId, requestId)
      : undefined;
    return { task, queued: submission?.status === 'queued' };
  }, context);
  if (!task) throw new Error('Durable request mapping is invalid');
  const input = task.input;
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    typeof input.conversationId !== 'string'
  )
    throw new Error('Durable request identity is invalid');
  return { requestId, conversationId: input.conversationId, status: requestState(task, queued) };
}
