import { createEnv } from '@eddo/core-server';
import nano from 'nano';
import { createHash } from 'node:crypto';

/** Honors existing pre-Durable receipts without creating new legacy reservations. */
export async function hasReportReservation(databaseName: string, key: string): Promise<boolean> {
  const env = createEnv();
  const database = nano(env.COUCHDB_URL).db.use(databaseName);
  const id = `_local/scheduled-report-${createHash('sha256').update(key).digest('hex')}`;
  try {
    await database.get(id);
    return true;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 404
    )
      return false;
    throw error;
  }
}
