import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { CouchDbStorage } from 'pi-durable-couchdb';
import { describe, expect, it, vi } from 'vitest';
import { acquireJournalOwnership } from './journal_ownership.js';
import { createJournalDatabase, deferred } from './test_helpers.js';

describe('exclusive journal ownership foundation', () => {
  it('allows exactly one concurrent claimant through the publication-head CAS', async () => {
    const database = createJournalDatabase();
    const results = await Promise.allSettled([
      acquireJournalOwnership(database),
      acquireJournalOwnership(database),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(acquireJournalOwnership(database)).rejects.toThrow('already has an owner');
  });

  it('retains ownership metadata across actual adapter publications and advances the fencing epoch on handover', async () => {
    const database = createJournalDatabase();
    const first = await acquireJournalOwnership(database);
    const storage = await CouchDbStorage.open(first.database);
    await storage.mintId();
    await first.assertOwned();
    await storage.close(BACKGROUND_CONTEXT);
    await first.release();
    const second = await acquireJournalOwnership(database);
    expect((await database.get('pi:head'))?.eddoOwnershipEpoch).toBe(2);
    await second.assertOwned();
    await second.release();
  });

  it('invalidates the cached publication revision of an older unowned adapter', async () => {
    const database = createJournalDatabase();
    const stale = await CouchDbStorage.open(database);
    const current = await acquireJournalOwnership(database);
    await expect(stale.mintId()).rejects.toThrow('storage failed');
    await current.assertOwned();
    await stale.close(BACKGROUND_CONTEXT);
    await current.release();
  });

  it('waits for admitted operations before releasing and denies new operations while draining', async () => {
    const database = createJournalDatabase();
    const owner = await acquireJournalOwnership(database);
    const gate = deferred();
    const action = vi.fn(async () => {
      await gate.promise;
      return 'Done';
    });
    const running = owner.run(action);
    await vi.waitFor(() => expect(action).toHaveBeenCalledOnce());
    const releasing = owner.release();
    await expect(owner.run(action)).rejects.toThrow('closed');
    await expect(acquireJournalOwnership(database)).rejects.toThrow('already has an owner');
    gate.resolve();
    expect(await running).toBe('Done');
    await releasing;
    await owner.release();
    const replacement = await acquireJournalOwnership(database);
    await replacement.release();
  });

  it('denies new side effects and publication after detecting another ownership token', async () => {
    const database = createJournalDatabase();
    const owner = await acquireJournalOwnership(database);
    const storage = await CouchDbStorage.open(owner.database);
    const head = await database.get('pi:head');
    if (!head) throw new Error('Missing head');
    await database.put({
      ...head,
      eddoOwnership: { token: 'replacement', epoch: 2 },
      eddoOwnershipEpoch: 2,
    });
    const action = vi.fn();
    await expect(owner.run(action)).rejects.toThrow('ownership was lost');
    expect(action).not.toHaveBeenCalled();
    await expect(storage.mintId()).rejects.toThrow('storage failed');
    await expect(owner.release()).rejects.toThrow('lost before release');
    expect((await database.get('pi:head'))?.eddoOwnership).toEqual({
      token: 'replacement',
      epoch: 2,
    });
    await storage.close(BACKGROUND_CONTEXT);
  });

  it('does not free an ambiguously published acquisition', async () => {
    const database = createJournalDatabase();
    const ambiguous = {
      get: database.get,
      put: vi.fn(async (document: Parameters<typeof database.put>[0]) => {
        await database.put(document);
        throw new Error('Acknowledgment lost');
      }),
    };
    await expect(acquireJournalOwnership(ambiguous)).rejects.toThrow('Acknowledgment lost');
    await expect(acquireJournalOwnership(database)).rejects.toThrow('already has an owner');
  });

  it('fails closed on malformed metadata and conflicting head revisions', async () => {
    const database = createJournalDatabase();
    await database.put({ _id: 'pi:head', eddoOwnership: { token: 'invalid', epoch: -1 } });
    await expect(acquireJournalOwnership(database)).rejects.toThrow('Invalid journal ownership');
    const head = await database.get('pi:head');
    await database.put({ ...head, _id: 'pi:head', eddoOwnership: null, _conflicts: ['conflict'] });
    await expect(acquireJournalOwnership(database)).rejects.toThrow('Conflicted');
  });
});
