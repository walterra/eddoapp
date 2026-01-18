/**
 * Setup logging helpers for chat session initialization.
 */

import type { SetupLogEntry } from '@eddo/core-shared';

import type { getChatDb } from './chat-session-helpers';

type ChatDb = ReturnType<typeof getChatDb>;

/** Log a setup step as started */
export async function logStepStarted(
  chatDb: ChatDb,
  sessionId: string,
  step: string,
  message: string,
): Promise<void> {
  const entry: SetupLogEntry = {
    step,
    status: 'started',
    message,
    timestamp: new Date().toISOString(),
  };
  await appendSetupLog(chatDb, sessionId, entry);
}

/** Log a setup step as completed */
export async function logStepCompleted(
  chatDb: ChatDb,
  sessionId: string,
  step: string,
  message: string,
): Promise<void> {
  const entry: SetupLogEntry = {
    step,
    status: 'completed',
    message,
    timestamp: new Date().toISOString(),
  };
  await appendSetupLog(chatDb, sessionId, entry);
}

/** Options for logging a failed step */
export interface LogStepFailedOptions {
  chatDb: ChatDb;
  sessionId: string;
  step: string;
  message: string;
  error: string;
}

/** Log a setup step as failed */
export async function logStepFailed(opts: LogStepFailedOptions): Promise<void> {
  const { chatDb, sessionId, step, message, error } = opts;
  const entry: SetupLogEntry = {
    step,
    status: 'failed',
    message,
    timestamp: new Date().toISOString(),
    error,
  };
  await appendSetupLog(chatDb, sessionId, entry);
  await chatDb.update(sessionId, { setupError: error });
}

/** Append a setup log entry to the session */
async function appendSetupLog(
  chatDb: ChatDb,
  sessionId: string,
  entry: SetupLogEntry,
): Promise<void> {
  const session = await chatDb.get(sessionId);
  if (!session) return;

  const logs = session.setupLogs ?? [];
  logs.push(entry);
  await chatDb.update(sessionId, { setupLogs: logs });
}
