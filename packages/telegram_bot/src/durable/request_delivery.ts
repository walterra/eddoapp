import type { Context } from '@earendil-works/chord';
import type { NextTaskState, RunningTask } from '@earendil-works/pi-durable';
import type { MessageEntity } from 'grammy/types';
import { deliveryDeadline, deliveryRetry, MAX_DELIVERY_FAILURES } from './delivery_policy.js';
import type { RequestRuntime } from './request_generation.js';
import type { RequestDependencies } from './request_task.js';
import type { DurableRequestInput, RequestCheckpoint } from './state.js';
import { formatTelegramText, telegramChunkEntities } from './telegram_format.js';
import type { TelegramSendOptions } from './telegram_send.js';

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

/** Persists rendered text so chunk offsets remain stable across restarts and parser upgrades. */
async function prepareTelegramDelivery(
  task: DeliveryTask,
  runtime: RequestRuntime,
  context: Context,
): Promise<boolean> {
  const checkpoint = task.state.checkpoint;
  if (checkpoint.telegram || checkpoint.offset > 0) return false;
  const telegram = formatTelegramText(checkpoint.answer);
  if (telegram.text === checkpoint.answer && !telegram.entities.length) return false;
  await runtime.commit(
    () => ({ status: 'running', checkpoint: { ...checkpoint, telegram } }),
    context,
  );
  return true;
}

/** Applies scheduled briefing preview suppression without changing other reply defaults. */
function chunkSendOptions(
  input: DurableRequestInput,
  entities: MessageEntity[],
): TelegramSendOptions | undefined {
  const disableLinkPreview = input.report?.type === 'briefing';
  if (!entities.length && !disableLinkPreview) return undefined;
  return {
    ...(entities.length ? { entities } : {}),
    ...(disableLinkPreview ? { disableLinkPreview: true } : {}),
  };
}

/** Sends entity-aware chunks while preserving raw offsets for older partial deliveries. */
async function sendChunk(task: DeliveryTask, dependencies: RequestDependencies): Promise<number> {
  const checkpoint = task.state.checkpoint;
  const chunk = telegramChunk(checkpoint.telegram?.text ?? checkpoint.answer, checkpoint.offset);
  const entities = telegramChunkEntities(
    checkpoint.telegram?.entities ?? [],
    checkpoint.offset,
    chunk.length,
  );
  const options = chunkSendOptions(task.input, entities);
  if (chunk) {
    if (options) await dependencies.send(task.input.chatId, chunk, options);
    else await dependencies.send(task.input.chatId, chunk);
  }
  return chunk.length;
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
  if (await prepareTelegramDelivery(task, runtime, context)) return;
  let sent: number;
  try {
    sent = await sendChunk(task, dependencies);
  } catch (error) {
    return recordSendFailure(task, runtime, context, error);
  }
  const offset = checkpoint.offset + sent;
  await runtime.commit(
    () =>
      offset >= (checkpoint.telegram?.text ?? checkpoint.answer).length
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
  return {
    status: 'running',
    checkpoint: { phase: 'project', answer, ...(failure ? { failure } : {}) },
  };
}
