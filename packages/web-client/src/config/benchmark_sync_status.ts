import type { SafeDbOperations } from '../api/safe-db-operations';

interface BenchmarkRevision {
  id: string;
  rev: string | null;
}
interface BenchmarkChange {
  id: string;
  rev: string;
  at: number;
}
interface RevisionDocument {
  _rev: string;
}

declare global {
  interface Window {
    __eddoBenchmarkChanges?: BenchmarkChange[];
    __eddoBenchmarkRevisions?: (ids: string[]) => Promise<BenchmarkRevision[]>;
  }
}

/** Exposes read-only revision verification in explicitly enabled benchmark sessions. */
export function exposeBenchmarkSyncStatus(safeDb: SafeDbOperations): void {
  if (typeof window === 'undefined' || sessionStorage.getItem('eddoBenchmark') !== 'true') return;
  window.__eddoBenchmarkChanges = [];
  window.__eddoBenchmarkRevisions = async (ids) =>
    Promise.all(
      ids.map(async (id) => ({
        id,
        rev: (await safeDb.safeGet<RevisionDocument>(id))?._rev ?? null,
      })),
    );
}

/** Records local change arrival without document contents or altering invalidation. */
export function recordBenchmarkChange(id: string, rev: string): void {
  if (typeof window === 'undefined' || !window.__eddoBenchmarkChanges) return;
  window.__eddoBenchmarkChanges.push({ id, rev, at: Date.now() });
  if (window.__eddoBenchmarkChanges.length > 10000) window.__eddoBenchmarkChanges.shift();
}
