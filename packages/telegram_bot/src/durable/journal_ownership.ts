import { randomUUID } from 'node:crypto';
import type { CouchDatabase, CouchDocument } from 'pi-durable-couchdb';
import { z } from 'zod';

const HEAD = 'pi:head';
const OWNER = 'eddoOwnership';

const OwnershipSchema = z.object({
  token: z.string().min(1),
  epoch: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
type OwnershipRecord = z.infer<typeof OwnershipSchema>;

export interface JournalOwnership {
  database: CouchDatabase;
  assertOwned: () => Promise<void>;
  run: <T>(operation: () => Promise<T>) => Promise<T>;
  release: () => Promise<void>;
}

/** Rejects malformed ownership metadata rather than interpreting it as an unlocked journal. */
function ownership(head: CouchDocument): OwnershipRecord | undefined {
  const value = head[OWNER];
  if (value === undefined || value === null) return undefined;
  const parsed = OwnershipSchema.safeParse(value);
  if (!parsed.success || parsed.data.epoch !== head.eddoOwnershipEpoch)
    throw new Error('Invalid journal ownership');
  return parsed.data;
}

/** Reads the retained fencing epoch even after a graceful release. */
function nextEpoch(head: CouchDocument): number {
  const epoch = head.eddoOwnershipEpoch ?? 0;
  if (!Number.isSafeInteger(epoch) || Number(epoch) < 0 || Number(epoch) >= Number.MAX_SAFE_INTEGER)
    throw new Error('Invalid journal ownership epoch');
  return Number(epoch) + 1;
}

/** Claims the publication head with the same CouchDB CAS that fences journal publication. */
export async function acquireJournalOwnership(database: CouchDatabase): Promise<JournalOwnership> {
  const head = (await database.get(HEAD)) ?? {
    _id: HEAD,
    format: 1,
    commitId: null,
    sequence: 0,
    nextId: 2,
  };
  if (Array.isArray(head._conflicts) && head._conflicts.length)
    throw new Error('Conflicted journal ownership head');
  if (ownership(head))
    throw new Error('Journal already has an owner; automatic takeover is disabled');
  const claim = { token: randomUUID(), epoch: nextEpoch(head) };
  await database.put({ ...head, [OWNER]: claim, eddoOwnershipEpoch: claim.epoch });
  return ownedJournal(database, claim);
}

/** Holds ownership until explicit release; no clock, TTL, or unsafe automatic takeover is used. */
function ownedJournal(database: CouchDatabase, claim: OwnershipRecord): JournalOwnership {
  let accepting = true;
  let released = false;
  let releasePromise: Promise<void> | undefined;
  const pending = new Set<Promise<unknown>>();
  const assertLocal = (): void => {
    if (!accepting || released) throw new Error('Journal ownership is closed');
  };
  const assertHead = (head: CouchDocument | undefined): void => assertClaim(head, claim);
  const assertOwned = async (): Promise<void> => {
    assertLocal();
    assertHead(await database.get(HEAD));
    assertLocal();
  };
  const run = async <T>(operation: () => Promise<T>): Promise<T> => {
    const work = (async () => {
      await assertOwned();
      return operation();
    })();
    pending.add(work);
    try {
      return await work;
    } finally {
      pending.delete(work);
    }
  };
  const release = (): Promise<void> => {
    accepting = false;
    releasePromise ??= releaseClaim(database, claim, pending).finally(() => {
      released = true;
    });
    return releasePromise;
  };
  return {
    database: guardedDatabase(database, assertLocal, assertHead),
    assertOwned,
    run,
    release,
  };
}

/** Rejects missing, conflicted, or foreign publication authority. */
function assertClaim(head: CouchDocument | undefined, claim: OwnershipRecord): void {
  if (!head) throw new Error('Journal ownership head is missing');
  if (Array.isArray(head._conflicts) && head._conflicts.length)
    throw new Error('Conflicted journal ownership head');
  const actual = ownership(head);
  if (actual?.token !== claim.token || actual.epoch !== claim.epoch)
    throw new Error('Journal ownership was lost');
}

/** Rejects foreign publication metadata while preserving the adapter's exact revision precondition. */
function guardedDatabase(
  database: CouchDatabase,
  assertLocal: () => void,
  assertHead: (head: CouchDocument | undefined) => void,
): CouchDatabase {
  return {
    get: async (id) => {
      assertLocal();
      const document = await database.get(id);
      if (id === HEAD) assertHead(document);
      return document;
    },
    put: async (document) => {
      assertLocal();
      if (document._id === HEAD) assertHead(document);
      return database.put(document);
    },
  };
}

/** Waits for admitted effects and releases only the matching token through a fresh head CAS. */
async function releaseClaim(
  database: CouchDatabase,
  claim: OwnershipRecord,
  pending: ReadonlySet<Promise<unknown>>,
): Promise<void> {
  await Promise.allSettled([...pending]);
  const head = await database.get(HEAD);
  if (!head) throw new Error('Journal ownership head is missing during release');
  if (Array.isArray(head._conflicts) && head._conflicts.length)
    throw new Error('Conflicted journal ownership head');
  const actual = ownership(head);
  if (actual?.token !== claim.token || actual.epoch !== claim.epoch)
    throw new Error('Journal ownership was lost before release');
  await database.put({ ...head, [OWNER]: null });
}
