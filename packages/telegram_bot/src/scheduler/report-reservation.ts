import { createEnv } from '@eddo/core-server';
import nano from 'nano';
import { createHash } from 'node:crypto';

interface ReservationDocument {
  _id: string;
  _rev?: string;
}

/**
 * Runs a reserved report, releasing only confirmed generation failures.
 * Retains reservations after exceptions because Telegram delivery may have succeeded.
 */
export async function runReservedReport(
  databaseName: string,
  key: string,
  send: () => Promise<boolean>,
): Promise<boolean> {
  const release = await reserveReport(databaseName, key);
  if (!release) return false;
  const wasSent = await send();
  if (!wasSent) await release();
  return wasSent;
}

/** Reserves a report atomically across scheduler instances and restarts. */
export async function reserveReport(
  databaseName: string,
  key: string,
): Promise<(() => Promise<void>) | null> {
  const env = createEnv();
  const database = nano(env.COUCHDB_URL).db.use<ReservationDocument>(databaseName);
  const document = {
    _id: `_local/scheduled-report-${createHash('sha256').update(key).digest('hex')}`,
  };
  try {
    const result = await database.insert(document);
    return async () => {
      await database.destroy(document._id, result.rev);
    };
  } catch (error) {
    if (isConflict(error)) return null;
    throw error;
  }
}

function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'statusCode' in error && error.statusCode === 409
  );
}
