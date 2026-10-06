import { createDefaultUserPreferences } from '@eddo/core-shared';
import nano from 'nano';
import { createHash } from 'node:crypto';
import { generateFixture, type DayPagingProfile } from './day_paging_fixture';

export const BENCHMARK_PASSWORD = 'synthetic-benchmark-password';

/** Restores identical todo contents before each isolated browser view. */
export async function resetBenchmarkDatabase(
  url: string,
  profile: DayPagingProfile,
): Promise<void> {
  const couch = nano(url);
  await couch.db.destroy('eddo_user_benchmark');
  await couch.db.create('eddo_user_benchmark');
  const db = couch.db.use('eddo_user_benchmark');
  const docs = generateFixture(profile);
  for (let offset = 0; offset < docs.length; offset += 500) {
    const results = await db.bulk({ docs: docs.slice(offset, offset + 500) });
    if (results.some((result) => 'error' in result)) throw new Error('Fixture reset failed');
  }
}

/** Creates synthetic account data in the disposable container only. */
export async function seedDatabase(url: string, profile: DayPagingProfile): Promise<string> {
  const couch = nano(url);
  const docs = generateFixture(profile);
  for (const name of ['eddo_user_registry', 'eddo_user_benchmark', 'eddo_attachments_benchmark']) {
    await couch.db.create(name);
  }
  const { hashPassword } = await import('../../packages/web-api/src/utils/crypto');
  await couch.db.use<Record<string, unknown>>('eddo_user_registry').insert({
    _id: 'user_benchmark',
    username: 'benchmark',
    email: 'benchmark@example.invalid',
    password_hash: await hashPassword(BENCHMARK_PASSWORD),
    database_name: 'eddo_user_benchmark',
    created_at: `${profile.referenceDate}T00:00:00Z`,
    updated_at: `${profile.referenceDate}T00:00:00Z`,
    permissions: ['read', 'write'],
    status: 'active',
    version: 'alpha2',
    preferences: {
      ...createDefaultUserPreferences(),
      timezone: 'UTC',
      selectedTimeRange: { type: 'current-day' },
      currentDate: `${profile.referenceDate}T12:00:00Z`,
      selectedStatus: 'all',
      viewMode: 'kanban',
    },
  });
  const db = couch.db.use('eddo_user_benchmark');
  for (let offset = 0; offset < docs.length; offset += 500) {
    const results = await db.bulk({ docs: docs.slice(offset, offset + 500) });
    if (results.some((result) => 'error' in result)) throw new Error('Fixture bulk insert failed');
  }
  return createHash('sha256').update(JSON.stringify(docs)).digest('hex');
}
