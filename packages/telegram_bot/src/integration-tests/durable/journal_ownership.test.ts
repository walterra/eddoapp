import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { CouchDBContainer, type StartedCouchDBContainer } from '@testcontainers/couchdb';
import { randomUUID } from 'node:crypto';
import { couchDatabase, CouchDbStorage, type CouchDatabase } from 'pi-durable-couchdb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { acquireJournalOwnership } from '../../durable/journal_ownership.js';

let container: StartedCouchDBContainer;
let authorization: string;

beforeAll(async () => {
  const password = randomUUID();
  container = await new CouchDBContainer('couchdb:3.5.0')
    .withUsername('admin')
    .withPassword(password)
    .start();
  authorization = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`;
});
afterAll(async () => {
  await container?.stop();
});

async function database(): Promise<CouchDatabase> {
  const url = `http://${container.getHost()}:${container.getMappedPort(5984)}/owner_${randomUUID().replaceAll('-', '')}`;
  const response = await fetch(url, { method: 'PUT', headers: { Authorization: authorization } });
  expect(response.status).toBe(201);
  return couchDatabase({ url, headers: { Authorization: authorization } });
}

describe('journal ownership on real CouchDB', () => {
  it('admits one concurrent owner and permits a higher-epoch handover after release', async () => {
    const db = await database();
    const results = await Promise.allSettled([
      acquireJournalOwnership(db),
      acquireJournalOwnership(db),
    ]);
    const acquired = results.filter((result) => result.status === 'fulfilled');
    expect(acquired).toHaveLength(1);
    const owner = acquired[0];
    if (owner.status !== 'fulfilled') throw new Error('No owner');
    const storage = await CouchDbStorage.open(owner.value.database);
    await storage.mintId();
    await owner.value.assertOwned();
    await storage.close(BACKGROUND_CONTEXT);
    await owner.value.release();
    const replacement = await acquireJournalOwnership(db);
    expect((await db.get('pi:head'))?.eddoOwnershipEpoch).toBe(2);
    await replacement.assertOwned();
    await replacement.release();
  });

  it('fences a cached old publication head without losing the new owner claim', async () => {
    const db = await database();
    const stale = await CouchDbStorage.open(db);
    const owner = await acquireJournalOwnership(db);
    await expect(stale.mintId()).rejects.toThrow('storage failed');
    await owner.assertOwned();
    await stale.close(BACKGROUND_CONTEXT);
    await owner.release();
  });
});
