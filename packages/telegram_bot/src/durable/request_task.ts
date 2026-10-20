import type { Context } from '@earendil-works/chord';
import { withAbortSignal } from '@earendil-works/chord/context';
import {
  defineTask,
  type EntryRecord,
  type NextTaskState,
  type RunningTask,
  type Submission,
  type SubmissionRecord,
  type TaskRuntime,
} from '@earendil-works/pi-durable';
import { prepareReply } from './report_delivery.js';
import type { DurableRequestInput, RequestCheckpoint } from './state.js';

type RequestRuntime = TaskRuntime<DurableRequestInput, RequestCheckpoint, string, object>;

export interface RequestDependencies {
  authorize: (input: DurableRequestInput) => Promise<unknown>;
  send: (chatId: number, text: string) => Promise<unknown>;
  project: (input: DurableRequestInput, answer: string) => Promise<void>;
  print?: (input: DurableRequestInput, answer: string) => Promise<void>;
}

/** Waits until completion or the persisted admission deadline, without aborting on shutdown. */
async function generateAnswer(
  input: DurableRequestInput,
  runtime: RequestRuntime,
  context: Context,
): Promise<string> {
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, input.deadline - Date.now()));
  try {
    const settled = await submission.wait(withAbortSignal(controller.signal, context));
    if (settled.status !== 'done' || settled.type !== 'input')
      return 'The request could not complete. Inspect current task state before retrying mutations.';
    const entry = await runtime.entry(settled.answer, context);
    return answerText(entry);
  } catch (error) {
    if (runtime.signal.aborted || !controller.signal.aborted) throw error;
    return finishExpiredSubmission(submission, runtime, context);
  } finally {
    clearTimeout(timer);
  }
}

/** Retains an already committed answer when the host restarts after the run deadline. */
async function recoveredAnswer(
  input: DurableRequestInput,
  runtime: RequestRuntime,
  context: Context,
): Promise<string> {
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
  return 'The request expired during interruption. Inspect current task state before retrying mutations.';
}

/** Withdraws only this queued input; never aborts another request sharing the conversation. */
async function finishExpiredSubmission(
  submission: Submission,
  runtime: RequestRuntime,
  context: Context,
): Promise<string> {
  await submission.abort(context);
  const settled = await submission.wait(context);
  if (settled.type === 'input' && settled.status === 'done')
    return answerText(await runtime.entry(settled.answer, context));
  return 'The queued request expired. Inspect current task state before retrying mutations.';
}

/** Extracts only final assistant text, excluding thinking and tool arguments. */
function answerText(entry: EntryRecord | undefined): string {
  const text = entry?.model
    ?.flatMap((message) => {
      if (message.role !== 'assistant') return [];
      return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : []));
    })
    .join('\n')
    .trim();
  return (
    text ||
    'Execution stopped without a final answer. Inspect current task state before continuing.'
  );
}

type DeliveryCheckpoint = Extract<RequestCheckpoint, { phase: 'deliver' }>;
type DeliveryTask = RunningTask<DurableRequestInput, DeliveryCheckpoint, string>;

/** Splits plain-text Telegram output without separating UTF-16 surrogate pairs. */
export function telegramChunk(answer: string, offset: number): string {
  let end = Math.min(answer.length, offset + 4000);
  const last = answer.charCodeAt(end - 1);
  if (end < answer.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
  return answer.slice(offset, end);
}

/** Retries external failures but lets failed journal commits terminate the Harness. */
async function deliverAnswer(
  task: DeliveryTask,
  runtime: RequestRuntime,
  context: Context,
  dependencies: RequestDependencies,
): Promise<void> {
  await dependencies.authorize(task.input);
  const checkpoint = task.state.checkpoint;
  const chunk = telegramChunk(checkpoint.answer, checkpoint.offset);
  try {
    if (!checkpoint.projected) await dependencies.project(task.input, checkpoint.answer);
    if (chunk) await dependencies.send(task.input.chatId, chunk);
  } catch (error) {
    if (runtime.signal.aborted) throw error;
    runtime.report(error);
    await runtime.sleep(Date.now() + 30_000, context);
    await runtime.commit(
      () => ({
        status: 'running',
        checkpoint: {
          ...checkpoint,
          attempts: checkpoint.attempts + 1,
        },
      }),
      context,
    );
    return;
  }
  const offset = checkpoint.offset + chunk.length;
  await runtime.commit(
    () =>
      offset >= checkpoint.answer.length
        ? deliveryFinished(task)
        : { status: 'running', checkpoint: { ...checkpoint, projected: true, offset } },
    context,
  );
}

/** Moves reports to printing only after every Telegram chunk has a committed delivery receipt. */
function deliveryFinished(task: DeliveryTask): NextTaskState<RequestCheckpoint, string> {
  const { answer, printable } = task.state.checkpoint;
  if (task.input.report)
    return {
      status: 'running',
      checkpoint: { phase: 'print', answer, printable: printable ?? false },
    };
  return { status: 'terminal', outcome: { status: 'completed', result: answer } };
}

type PrintTask = RunningTask<
  DurableRequestInput,
  Extract<RequestCheckpoint, { phase: 'print' }>,
  string
>;

/** Claims printing before the external effect, preferring a missed print over a duplicate. */
async function printAnswer(
  task: PrintTask,
  runtime: RequestRuntime,
  context: Context,
  dependencies: RequestDependencies,
): Promise<void> {
  await dependencies.authorize(task.input);
  const { answer, printable } = task.state.checkpoint;
  if (
    printable &&
    dependencies.print &&
    !(await runtime.memo<boolean>('print-attempted', context))
  ) {
    await runtime.memo('print-attempted', true, context);
    runtime.signal.throwIfAborted();
    try {
      await dependencies.print(task.input, answer);
    } catch (error) {
      if (runtime.signal.aborted) throw error;
      runtime.report(error);
    }
  }
  await runtime.commit(
    () => ({ status: 'terminal', outcome: { status: 'completed', result: answer } }),
    context,
  );
}

/** Stores delivery offsets after each accepted Telegram chunk; ambiguous sends may repeat. */
export function createRequestTask(
  dependencies: RequestDependencies,
): ReturnType<typeof defineTask<DurableRequestInput, RequestCheckpoint, string>> {
  return defineTask<DurableRequestInput, RequestCheckpoint, string>({
    name: 'eddo.telegram-request',
    version: 1,
    initial: () => ({ phase: 'generate' }),
    phases: {
      generate: async (task, runtime, context) => {
        await dependencies.authorize(task.input);
        const reply = prepareReply(task.input, await generateAnswer(task.input, runtime, context));
        await runtime.commit(
          () => ({
            status: 'running',
            checkpoint: {
              phase: 'deliver',
              answer: reply.answer,
              printable: reply.printable,
              offset: 0,
              projected: false,
              attempts: 0,
            },
          }),
          context,
        );
      },
      deliver: (task, runtime, context) => deliverAnswer(task, runtime, context, dependencies),
      print: (task, runtime, context) => printAnswer(task, runtime, context, dependencies),
    },
    abort: async (_task, runtime, context) => {
      await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context);
    },
  });
}
