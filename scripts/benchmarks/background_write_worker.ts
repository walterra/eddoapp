import nano from 'nano';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import {
  createIngestedTodo,
  type BackgroundPlan,
  type WriteReceipt,
} from './background_write_plan';
import type { SyntheticTodo } from './day_paging_fixture';

type RevisionTodo = SyntheticTodo & { _rev: string };

/** Commits a batch directly to disposable CouchDB, independently of browser commands. */
async function writeBatch(
  db: nano.DocumentScope<RevisionTodo>,
  plan: BackgroundPlan,
  batch: number,
): Promise<WriteReceipt> {
  const startedAt = Date.now();
  const docs = plan.targetIds.length
    ? await Promise.all(
        plan.targetIds.map(async (id) => {
          const doc = await db.get(id);
          return {
            ...doc,
            title: `Background revision ${batch}: ${id}`,
            metadata: { ...doc.metadata, 'benchmark:batch': String(batch) },
          };
        }),
      )
    : Array.from({ length: plan.count }, (_, index) =>
        createIngestedTodo(plan, batch * plan.count + index),
      );
  const results = await db.bulk({ docs });
  const revisions = results.map((result) => {
    if ('error' in result || !result.rev) throw new Error('Background bulk write failed');
    return { id: result.id, rev: result.rev };
  });
  return { batch, startedAt, acknowledgedAt: Date.now(), revisions };
}

/** Runs a wall-clock schedule; synchronous browser calls cannot pause this process. */
async function main(): Promise<void> {
  const plan: BackgroundPlan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const url = process.env.BENCHMARK_COUCH_URL;
  if (!url) throw new Error('Missing disposable CouchDB URL');
  const db = nano(url).db.use<RevisionTodo>('eddo_user_benchmark');
  const started = Date.now();
  writeFileSync(`${plan.directory}/writer-ready.json`, JSON.stringify({ started }));
  for (let batch = 0; batch < plan.batches; batch++) {
    const scheduledAt = started + plan.delayMs + batch * plan.intervalMs;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, scheduledAt - Date.now())));
    const receipt = await writeBatch(db, plan, batch);
    appendFileSync(
      `${plan.directory}/server-writes.jsonl`,
      `${JSON.stringify({ ...receipt, scheduledAt })}\n`,
    );
    console.log(
      `background: batch ${batch + 1}/${plan.batches}, ${receipt.revisions.length} writes acknowledged`,
    );
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Background writer failed');
  process.exitCode = 1;
});
