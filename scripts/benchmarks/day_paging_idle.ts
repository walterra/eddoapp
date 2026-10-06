import { appendFileSync } from 'node:fs';
import { browser } from './day_paging_browser';

interface QueryStatus {
  fetching: number;
  queryCount: number;
}

/** Requires repeated idle query observations after the initial view is ready. */
export async function waitForQueryIdle(session: string, directory: string): Promise<void> {
  const started = Date.now();
  let idleSamples = 0;
  while (Date.now() - started < 120000) {
    const output = browser(session, ['eval', 'window.__eddoBenchmarkQueryStatus?.() ?? null']);
    const status: QueryStatus | null = JSON.parse(output);
    if (!status) throw new Error('Benchmark query observation missing; rebuild the frontend');
    idleSamples = status.fetching === 0 ? idleSamples + 1 : 0;
    console.log(
      `application warmup: ${status.fetching} fetching queries, ${status.queryCount} cache entries`,
    );
    appendFileSync(
      `${directory}/application-warmup.jsonl`,
      `${JSON.stringify({ elapsedMs: Date.now() - started, ...status })}\n`,
    );
    if (idleSamples >= 3) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Application queries did not settle within 120s');
}
