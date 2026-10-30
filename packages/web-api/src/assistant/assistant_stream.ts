import { setTimeout as delay } from 'node:timers/promises';
import { changeCursor } from './assistant_cursors';
import { AssistantApiError } from './assistant_errors';
import {
  AssistantCursorExpiredError,
  type AssistantChangesBatch,
  type AssistantIdentity,
  type AssistantService,
} from './assistant_types';

export interface AssistantEventSink {
  send: (event: string, data: unknown, id?: string) => Promise<void>;
}
export interface AssistantStreamOptions {
  since?: string;
  requestIds: string[];
  signal: AbortSignal;
}

/** Revalidates account access after asynchronous reads and before emitting private state. */
async function access(
  service: AssistantService,
  identity: AssistantIdentity,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  if (Date.now() >= identity.expiresAt) throw new AssistantApiError(401, 'unauthorized');
  await service.authorize(identity.username);
  signal.throwIfAborted();
}

async function pendingStatuses(
  service: AssistantService,
  identity: AssistantIdentity,
  options: AssistantStreamOptions,
  sink: AssistantEventSink,
): Promise<void> {
  try {
    const pending = await service.host.pending(identity.username, options.signal);
    await access(service, identity, options.signal);
    await sink.send('pending-requests', pending);
  } catch (error) {
    if (!(error instanceof AssistantApiError) || error.status !== 503) throw error;
    await access(service, identity, options.signal);
    await sink.send('unavailable', { error: 'unavailable' });
  }
}

async function statuses(
  service: AssistantService,
  identity: AssistantIdentity,
  options: AssistantStreamOptions,
  sink: AssistantEventSink,
): Promise<void> {
  await pendingStatuses(service, identity, options, sink);
  for (const requestId of options.requestIds) {
    try {
      const status = await service.host.status(identity.username, requestId, options.signal);
      await access(service, identity, options.signal);
      await sink.send(status ? 'request-status' : 'request-missing', status ?? { requestId });
    } catch (error) {
      if (!(error instanceof AssistantApiError) || error.status !== 503) throw error;
      await access(service, identity, options.signal);
      await sink.send('unavailable', { error: 'unavailable' });
      return;
    }
  }
}

async function readChanges(
  service: AssistantService,
  identity: AssistantIdentity,
  since: string,
  signal: AbortSignal,
): Promise<ResetChangesBatch> {
  try {
    return await service.store.changes(identity.username, since, signal);
  } catch (error) {
    if (!(error instanceof AssistantCursorExpiredError)) throw error;
    return {
      changes: [],
      lastSequence: await service.store.watermark(identity.username),
      reset: true,
    };
  }
}
interface ResetChangesBatch extends AssistantChangesBatch {
  reset?: boolean;
}

/** Replays persisted projection checkpoints and refreshes status snapshots, never an in-memory event buffer. */
export async function runAssistantStream(
  service: AssistantService,
  identity: AssistantIdentity,
  options: AssistantStreamOptions,
  sink: AssistantEventSink,
): Promise<void> {
  try {
    await access(service, identity, options.signal);
    let since = options.since ?? (await service.store.watermark(identity.username));
    if (options.since === undefined) {
      await access(service, identity, options.signal);
      const cursor = changeCursor(identity.username, since);
      await sink.send('reset', { cursor }, cursor);
    }
    while (!options.signal.aborted) {
      await access(service, identity, options.signal);
      await statuses(service, identity, options, sink);
      const batch: ResetChangesBatch = await readChanges(service, identity, since, options.signal);
      await access(service, identity, options.signal);
      if (batch.reset)
        await sink.send('reset', { cursor: changeCursor(identity.username, batch.lastSequence) });
      for (const change of batch.changes) {
        options.signal.throwIfAborted();
        await sink.send(
          'history-change',
          change.change,
          changeCursor(identity.username, change.sequence),
        );
      }
      since = batch.lastSequence;
      const cursor = changeCursor(identity.username, since);
      await sink.send('checkpoint', { cursor }, cursor);
      await delay(1000, undefined, { signal: options.signal });
    }
  } catch (error) {
    if (options.signal.aborted) return;
    const code = error instanceof AssistantApiError ? error.code : 'unavailable';
    await sink.send('error', { error: code });
  }
}
