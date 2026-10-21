import type { Context } from '@earendil-works/chord';
import { defineTask, type RunningTask } from '@earendil-works/pi-durable';
import type { MessageEntity } from 'grammy/types';
import { correctReportContext, type ContextWriter } from './report_context.js';
import { prepareReply } from './report_delivery.js';
import { deliverAnswer } from './request_delivery.js';
import { requestOutcome } from './request_failure.js';
import { generateAnswer, type RequestRuntime } from './request_generation.js';
import type { DurableRequestInput, ReportType, RequestCheckpoint } from './state.js';
export { telegramChunk } from './request_delivery.js';

export interface RequestDependencies {
  authorize: (input: DurableRequestInput) => Promise<unknown>;
  send: (chatId: number, text: string, entities?: MessageEntity[]) => Promise<unknown>;
  project: (input: DurableRequestInput, answer: string) => Promise<void>;
  print?: (input: DurableRequestInput, answer: string, reportType?: ReportType) => Promise<void>;
  reportRetryDelayMs?: number;
  writeContext?: ContextWriter;
}

type GenerateTask = RunningTask<
  DurableRequestInput,
  Extract<RequestCheckpoint, { phase: 'generate' }>,
  string
>;
type RetryTask = RunningTask<
  DurableRequestInput,
  Extract<RequestCheckpoint, { phase: 'retry' }>,
  string
>;
type PrintTask = RunningTask<
  DurableRequestInput,
  Extract<RequestCheckpoint, { phase: 'print' }>,
  string
>;

/** Retries only read-only scheduled generation, with stable attempt IDs and a bounded retry count. */
async function generateReply(
  task: GenerateTask,
  runtime: RequestRuntime,
  context: Context,
  dependencies: RequestDependencies,
): Promise<void> {
  await dependencies.authorize(task.input);
  const attempt = task.state.checkpoint.attempt ?? 0;
  const input = attempt
    ? { ...task.input, requestId: `${task.input.requestId}:retry:${attempt}` }
    : task.input;
  const result = await generateAnswer(input, runtime, context);
  const notBefore = Date.now() + (dependencies.reportRetryDelayMs ?? 30_000);
  if (result.retryable && task.input.report && attempt < 2 && notBefore < task.input.deadline) {
    runtime.report(new Error('Scheduled report generation failed; a bounded retry is pending.'));
    await runtime.commit(
      () => ({
        status: 'running',
        checkpoint: { phase: 'retry', attempt: attempt + 1, notBefore },
      }),
      context,
    );
    return;
  }
  if (result.failure) runtime.report(new Error(result.failure));
  const reply = prepareReply(task.input, result.answer);
  await correctReportContext(
    { input: task.input, generated: result, reply, writeContext: dependencies.writeContext },
    runtime,
    context,
  );
  await runtime.commit(
    () => ({
      status: 'running',
      checkpoint: {
        phase: 'deliver',
        answer: reply.answer,
        printable: reply.printable,
        ...(reply.reportType ? { reportType: reply.reportType } : {}),
        ...(result.failure ? { failure: result.failure } : {}),
        offset: 0,
        projected: false,
        attempts: 0,
      },
    }),
    context,
  );
}

/** Resumes a persisted backoff without resetting its wake time after restart. */
async function retryGeneration(
  task: RetryTask,
  runtime: RequestRuntime,
  context: Context,
): Promise<void> {
  await runtime.sleep(task.state.checkpoint.notBefore, context);
  await runtime.commit(
    () => ({
      status: 'running',
      checkpoint: { phase: 'generate', attempt: task.state.checkpoint.attempt },
    }),
    context,
  );
}

/** Claims printing before the external effect, preferring a missed print over a duplicate. */
async function printAnswer(
  task: PrintTask,
  runtime: RequestRuntime,
  context: Context,
  dependencies: RequestDependencies,
): Promise<void> {
  await dependencies.authorize(task.input);
  const { answer, printable, reportType, failure } = task.state.checkpoint;
  if (
    printable &&
    dependencies.print &&
    !(await runtime.memo<boolean>('print-attempted', context))
  ) {
    await runtime.memo('print-attempted', true, context);
    runtime.signal.throwIfAborted();
    try {
      if (reportType) await dependencies.print(task.input, answer, reportType);
      else await dependencies.print(task.input, answer);
    } catch (error) {
      if (runtime.signal.aborted) throw error;
      runtime.report(error);
    }
  }
  await runtime.commit(
    () => ({ status: 'terminal', outcome: requestOutcome(answer, failure) }),
    context,
  );
}

/** Stores generation outcomes and delivery offsets; ambiguous Telegram sends may repeat. */
export function createRequestTask(
  dependencies: RequestDependencies,
): ReturnType<typeof defineTask<DurableRequestInput, RequestCheckpoint, string>> {
  return defineTask<DurableRequestInput, RequestCheckpoint, string>({
    name: 'eddo.telegram-request',
    version: 1,
    initial: () => ({ phase: 'generate' }),
    phases: {
      generate: (task, runtime, context) => generateReply(task, runtime, context, dependencies),
      retry: (task, runtime, context) => retryGeneration(task, runtime, context),
      deliver: (task, runtime, context) => deliverAnswer(task, runtime, context, dependencies),
      print: (task, runtime, context) => printAnswer(task, runtime, context, dependencies),
    },
    abort: async (_task, runtime, context) => {
      await runtime.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), context);
    },
  });
}
