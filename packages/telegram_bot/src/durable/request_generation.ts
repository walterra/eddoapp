import type { Context } from '@earendil-works/chord';
import { withAbortSignal } from '@earendil-works/chord/context';
import type {
  EntryRecord,
  Submission,
  SubmissionRecord,
  TaskRuntime,
} from '@earendil-works/pi-durable';
import type { DurableRequestInput, RequestCheckpoint } from './state.js';

export type RequestRuntime = TaskRuntime<DurableRequestInput, RequestCheckpoint, string, object>;

export interface GenerationResult {
  answer: string;
  failure?: string;
  retryable?: boolean;
}

/** Waits for this input without treating a failed native run as a successful answer. */
export async function generateAnswer(
  input: DurableRequestInput,
  runtime: RequestRuntime,
  context: Context,
): Promise<GenerationResult> {
  const conversation = await runtime.conversation(runtime.conversationId, context);
  if (!conversation) throw new Error('Durable conversation is missing');
  if (Date.now() >= input.deadline) return recoveredAnswer(input, runtime, context);
  const submission = await conversation.submit(
    {
      type: 'input',
      content: `Current UTC date/time: ${input.createdAt}\n\n${input.text}`,
      requestId: input.requestId,
      entry: {
        kind: 'eddo.input',
        data: {
          requestId: input.requestId,
          receivedAt: input.createdAt,
          deadline: input.deadline,
          report: input.report?.type ?? null,
        },
      },
    },
    context,
  );
  return waitForAnswer(submission, input.deadline, runtime, context);
}

/** Bounds the wait while preserving shutdown recovery and committed native outcomes. */
async function waitForAnswer(
  submission: Submission,
  deadline: number,
  runtime: RequestRuntime,
  context: Context,
): Promise<GenerationResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - Date.now()));
  try {
    const settled = await submission.wait(withAbortSignal(controller.signal, context));
    if (settled.status !== 'done' || settled.type !== 'input')
      return {
        answer:
          'The request could not complete. Inspect current task state before retrying mutations.',
        failure: 'Native generation did not complete.',
        retryable: settled.status === 'unanswered' && settled.reason === 'model_error',
      };
    return answerText(await runtime.entry(settled.answer, context));
  } catch (error) {
    if (runtime.signal.aborted || !controller.signal.aborted) throw error;
    return finishExpiredSubmission(submission, runtime, context);
  } finally {
    clearTimeout(timer);
  }
}

/** Retains a committed answer when recovery starts after the admission deadline. */
async function recoveredAnswer(
  input: DurableRequestInput,
  runtime: RequestRuntime,
  context: Context,
): Promise<GenerationResult> {
  const records: SubmissionRecord[] = [];
  await runtime.commit(async (tx) => {
    const previous = await tx.submissionByRequest(runtime.conversationId, input.requestId);
    if (previous) records.push(previous);
    return undefined;
  }, context);
  const previous = records[0];
  if (previous?.type === 'input' && previous.status === 'done')
    return answerText(await runtime.entry(previous.answer, context));
  if (previous?.status === 'queued' || previous?.status === 'placed') {
    const conversation = await runtime.conversation(runtime.conversationId, context);
    if (!conversation) throw new Error('Durable conversation is missing');
    const submission = await conversation.submit(
      { type: 'input', content: input.text, requestId: input.requestId },
      context,
    );
    return finishExpiredSubmission(submission, runtime, context);
  }
  return {
    answer:
      'The request expired during interruption. Inspect current task state before retrying mutations.',
    failure: 'Request admission deadline expired.',
  };
}

/** Withdraws this input without aborting other requests in the conversation. */
async function finishExpiredSubmission(
  submission: Submission,
  runtime: RequestRuntime,
  context: Context,
): Promise<GenerationResult> {
  await submission.abort(context);
  const settled = await submission.wait(context);
  if (settled.type === 'input' && settled.status === 'done')
    return answerText(await runtime.entry(settled.answer, context));
  return {
    answer: 'The queued request expired. Inspect current task state before retrying mutations.',
    failure: 'Request admission deadline expired.',
  };
}

/** Extracts final assistant text and rejects empty answers without exposing provider diagnostics. */
function answerText(entry: EntryRecord | undefined): GenerationResult {
  const text = entry?.model
    ?.flatMap((message) => {
      if (message.role !== 'assistant') return [];
      return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : []));
    })
    .join('\n')
    .trim();
  return text
    ? { answer: text }
    : {
        answer:
          'Execution stopped without a final answer. Inspect current task state before continuing.',
        failure: 'Native generation produced no final answer.',
      };
}
