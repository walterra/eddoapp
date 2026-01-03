/**
 * SSE (Server-Sent Events) utilities for user preferences streaming
 */
import type { DocumentScope } from 'nano';

import { logger } from '../utils/logger';

export interface SSEStream {
  writeSSE: (data: { event?: string; data: string; id?: string }) => Promise<void>;
  sleep: (ms: number) => Promise<unknown>;
  onAbort: (callback: () => void) => void;
}

/** Send SSE heartbeat message */
export async function sendHeartbeat(stream: SSEStream): Promise<void> {
  await stream.writeSSE({
    event: 'heartbeat',
    data: JSON.stringify({ timestamp: new Date().toISOString() }),
  });
}

/** Send SSE connected message */
export async function sendConnectedMessage(stream: SSEStream, docId: string): Promise<void> {
  await stream.writeSSE({
    event: 'connected',
    data: JSON.stringify({ status: 'connected', docId }),
    id: '0',
  });
}

interface PreferencesStreamParams<T> {
  stream: SSEStream;
  username: string;
  docId: string;
  registryDb: DocumentScope<T>;
  createSafeProfile: (doc: T) => Record<string, unknown>;
}

/**
 * Handles the SSE preferences stream for a user
 */
export async function handlePreferencesStream<T>(
  params: PreferencesStreamParams<T>,
): Promise<void> {
  const { stream, username, docId, registryDb, createSafeProfile } = params;
  let isConnected = true;

  stream.onAbort(() => {
    logger.debug({ username }, 'SSE client disconnected');
    isConnected = false;
    registryDb.changesReader.stop();
  });

  try {
    const changesEmitter = registryDb.changesReader.start({
      includeDocs: true,
      since: 'now',
      selector: { _id: docId },
    });

    await sendConnectedMessage(stream, docId);

    changesEmitter.on('change', async (change) => {
      if (change.id !== docId || !change.doc) return;
      await stream.writeSSE({
        event: 'preference-update',
        data: JSON.stringify(createSafeProfile(change.doc)),
        id: String(change.seq),
      });
    });

    changesEmitter.on('error', (err) => logger.error({ error: err }, 'SSE changes feed error'));

    while (isConnected) {
      await stream.sleep(30000);
      if (isConnected) await sendHeartbeat(stream);
    }
  } catch (error) {
    logger.error({ error }, 'SSE stream error');
    registryDb.changesReader.stop();
  }
}
