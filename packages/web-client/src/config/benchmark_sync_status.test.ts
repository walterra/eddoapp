import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSafeDbOperations } from '../api/safe-db-operations';
import { exposeBenchmarkSyncStatus, recordBenchmarkChange } from './benchmark_sync_status';

type TestDatabase = Parameters<typeof createSafeDbOperations>[0];

afterEach(() => {
  sessionStorage.removeItem('eddoBenchmark');
  delete window.__eddoBenchmarkChanges;
  delete window.__eddoBenchmarkRevisions;
});

describe('benchmark sync observation', () => {
  it('does not record or expose revision access in normal sessions', () => {
    const db = { get: vi.fn() } as unknown as TestDatabase;
    exposeBenchmarkSyncStatus(createSafeDbOperations(db));
    recordBenchmarkChange('synthetic', '1-revision');
    expect(window.__eddoBenchmarkChanges).toBeUndefined();
    expect(window.__eddoBenchmarkRevisions).toBeUndefined();
    expect(db.get).not.toHaveBeenCalled();
  });
  it('returns revisions without document contents and records arrival timestamps', async () => {
    sessionStorage.setItem('eddoBenchmark', 'true');
    const get = vi.fn(async () => ({ _rev: '2-synthetic', description: 'private content' }));
    exposeBenchmarkSyncStatus(createSafeDbOperations({ get } as unknown as TestDatabase));
    expect(await window.__eddoBenchmarkRevisions?.(['synthetic'])).toEqual([
      { id: 'synthetic', rev: '2-synthetic' },
    ]);
    recordBenchmarkChange('synthetic', '2-synthetic');
    expect(window.__eddoBenchmarkChanges).toEqual([
      { id: 'synthetic', rev: '2-synthetic', at: expect.any(Number) },
    ]);
    expect(JSON.stringify(window.__eddoBenchmarkChanges)).not.toContain('private content');
  });
  it('reports missing local revisions without document contents', async () => {
    sessionStorage.setItem('eddoBenchmark', 'true');
    const get = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('missing'), { name: 'not_found' }));
    exposeBenchmarkSyncStatus(createSafeDbOperations({ get } as unknown as TestDatabase));
    expect(await window.__eddoBenchmarkRevisions?.(['missing'])).toEqual([
      { id: 'missing', rev: null },
    ]);
  });
  it('bounds the observation buffer', () => {
    window.__eddoBenchmarkChanges = Array.from({ length: 10000 }, () => ({
      id: 'old',
      rev: '1-old',
      at: 0,
    }));
    recordBenchmarkChange('new', '1-new');
    expect(window.__eddoBenchmarkChanges).toHaveLength(10000);
    expect(window.__eddoBenchmarkChanges[window.__eddoBenchmarkChanges.length - 1]?.id).toBe('new');
  });
});
