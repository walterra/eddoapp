/**
 * Setup logging utilities for tracking session initialization progress.
 */

import type { SetupLogEntry } from '@eddo/core-shared';

import type { getChatDb } from './chat-session-helpers';

/** Chat database type from getChatDb */
type ChatDb = ReturnType<typeof getChatDb>;

/** Create a setup log entry */
export function createSetupLog(
  step: SetupLogEntry['step'],
  status: SetupLogEntry['status'],
  message: string,
  error?: string,
): SetupLogEntry {
  return {
    timestamp: new Date().toISOString(),
    step,
    status,
    message,
    error,
  };
}

/** Append a setup log to session */
export async function appendSetupLog(
  chatDb: ChatDb,
  sessionId: string,
  log: SetupLogEntry,
): Promise<void> {
  const session = await chatDb.get(sessionId);
  const logs = session?.setupLogs ?? [];
  logs.push(log);
  const update: { setupLogs: SetupLogEntry[]; setupError?: string } = { setupLogs: logs };
  if (log.status === 'failed' && log.error) {
    update.setupError = log.error;
  }
  await chatDb.update(sessionId, update);
}

/** Clear setup logs for a fresh start */
export async function clearSetupLogs(chatDb: ChatDb, sessionId: string): Promise<void> {
  await chatDb.update(sessionId, { setupLogs: [], setupError: undefined });
}

/** Log a started step */
export async function logStepStarted(
  chatDb: ChatDb,
  sessionId: string,
  step: SetupLogEntry['step'],
  message: string,
): Promise<void> {
  await appendSetupLog(chatDb, sessionId, createSetupLog(step, 'started', message));
}

/** Log a completed step */
export async function logStepCompleted(
  chatDb: ChatDb,
  sessionId: string,
  step: SetupLogEntry['step'],
  message: string,
): Promise<void> {
  await appendSetupLog(chatDb, sessionId, createSetupLog(step, 'completed', message));
}

/** Parameters for logging a failed step */
interface LogFailedParams {
  chatDb: ChatDb;
  sessionId: string;
  step: SetupLogEntry['step'];
  message: string;
  error: string;
}

/** Log a failed step */
export async function logStepFailed(params: LogFailedParams): Promise<void> {
  const { chatDb, sessionId, step, message, error } = params;
  await appendSetupLog(chatDb, sessionId, createSetupLog(step, 'failed', message, error));
}
