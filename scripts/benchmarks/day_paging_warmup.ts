import { appendFileSync } from 'node:fs';
import { browser } from './day_paging_browser';

export interface WarmupOptions {
  session: string;
  totalTodos: number;
  lastId: string;
  directory: string;
  timeoutSeconds: number;
}

interface ReplicationProgress {
  docs: number;
  lastPresent: boolean;
  state: string;
  requests: number;
  recentPaths: string[];
}

/** Reads local IndexedDB counts and sanitized request paths during warm-up only. */
function readProgress(options: WarmupOptions): ReplicationProgress {
  const output = browser(options.session, [
    'eval',
    `(async () => {
    performance.setResourceTimingBufferSize(20000);
    const resources = performance.getEntriesByType('resource').filter(entry => entry.name.includes('/api/db'));
    const recentPaths = resources.filter(entry => !entry.name.includes('/_local/')).slice(-3).map(entry => new URL(entry.name).pathname);
    const result = { docs: 0, lastPresent: false, state: 'waiting for local database', requests: resources.length, recentPaths };
    const databases = await indexedDB.databases();
    const name = databases.find(db => db.name?.includes('eddo_user_benchmark'))?.name;
    if (!name) return result;
    return new Promise(resolve => {
      const request = indexedDB.open(name);
      request.onerror = () => resolve({ ...result, state: 'IndexedDB open failed' });
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('document-store')) { db.close(); resolve(result); return; }
        const transaction = db.transaction('document-store', 'readonly');
        const store = transaction.objectStore('document-store');
        const count = store.count(IDBKeyRange.bound('0000-', '9999-\uffff'));
        const last = store.get(${JSON.stringify(options.lastId)});
        transaction.oncomplete = () => {
          db.close(); resolve({ ...result, docs: count.result, lastPresent: !!last.result, state: 'replicating/indexing' });
        };
        transaction.onerror = () => { db.close(); resolve({ ...result, state: 'IndexedDB read failed' }); };
      };
    });
  })()`,
  ]);
  const parsed: unknown = JSON.parse(output);
  return (typeof parsed === 'string' ? JSON.parse(parsed) : parsed) as ReplicationProgress;
}

/** Reports live progress, exits on completion, and rejects stalled replication. */
export async function waitForReplication(options: WarmupOptions): Promise<void> {
  const started = Date.now();
  let lastAdvance = started;
  let previousDocs = 0;
  while (Date.now() - started < options.timeoutSeconds * 1000) {
    const progress = readProgress(options);
    const elapsedSeconds = (Date.now() - started) / 1000;
    if (progress.docs > previousDocs) lastAdvance = Date.now();
    previousDocs = progress.docs;
    const percentage = Math.min(100, (progress.docs / options.totalTodos) * 100);
    const speed = progress.docs / Math.max(1, elapsedSeconds);
    console.log(
      `warmup: ${progress.docs}/${options.totalTodos} (${percentage.toFixed(1)}%) | ${elapsedSeconds.toFixed(1)}s | ${speed.toFixed(1)} docs/s | completed requests=${progress.requests} | ${progress.state} | ${progress.recentPaths.join(', ')}`,
    );
    appendFileSync(
      `${options.directory}/warmup.jsonl`,
      `${JSON.stringify({ elapsedSeconds, ...progress })}\n`,
    );
    if (progress.docs >= options.totalTodos && progress.lastPresent) {
      console.log(
        `warmup: replication complete in ${elapsedSeconds.toFixed(1)}s; checking visible content`,
      );
      return;
    }
    if (Date.now() - lastAdvance > 120000) {
      throw new Error(
        `Replication stalled for 120s at ${progress.docs}/${options.totalTodos}; inspect warmup.jsonl and failure diagnostics`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    `Replication exceeded ${options.timeoutSeconds}s; inspect warmup.jsonl for progress`,
  );
}
