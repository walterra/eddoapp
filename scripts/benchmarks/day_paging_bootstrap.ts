import { appendFileSync } from 'node:fs';
import { browser } from './day_paging_browser';
import type { WarmupOptions } from './day_paging_warmup';

interface BootstrapProgress {
  stage: string;
  docs: number;
  total: number;
  elapsedMs: number;
  done: boolean;
  error?: string;
}

/** Observes preparation separately from application startup and measured paging. */
export async function waitForBootstrap(options: WarmupOptions): Promise<void> {
  const started = Date.now();
  let lastAdvance = started;
  let previousDocs = -1;
  let previousStage = '';
  while (Date.now() - started < options.timeoutSeconds * 1000) {
    const output = browser(options.session, ['eval', 'window.__eddoBootstrap ?? null']);
    const progress: BootstrapProgress | null = JSON.parse(output);
    if (progress) {
      if (progress.docs > previousDocs || progress.stage !== previousStage)
        lastAdvance = Date.now();
      previousDocs = progress.docs;
      previousStage = progress.stage;
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `bootstrap: ${progress.docs}/${progress.total || options.totalTodos} | ${elapsed}s | ${progress.stage}`,
      );
      appendFileSync(`${options.directory}/bootstrap.jsonl`, `${JSON.stringify(progress)}\n`);
      if (progress.error) throw new Error(`Database preparation failed: ${progress.error}`);
      if (progress.done) return;
    }
    if (Date.now() - lastAdvance > 120000) throw new Error('Database preparation stalled for 120s');
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Database preparation exceeded ${options.timeoutSeconds}s`);
}
