import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import {
  createBackgroundPlan,
  type BackgroundPlan,
  type WriteReceipt,
} from './background_write_plan';
import { telemetryEnvironment, telemetryImports } from './benchmark_telemetry';
import { browser } from './day_paging_browser';
import { generateFixture } from './day_paging_fixture';
import type { BenchmarkOptions } from './day_paging_options';

interface BackgroundRun {
  child: ChildProcess;
  finished: Promise<void>;
  plan: BackgroundPlan;
}
interface LocalRevision {
  id: string;
  rev: string | null;
}
interface LocalChange {
  id: string;
  rev: string;
  at: number;
}

/** Launches the owned writer with optional SDK preloading and isolated service metadata. */
function launchWriter(url: string, options: BenchmarkOptions, plan: BackgroundPlan): BackgroundRun {
  const child = spawn(
    process.execPath,
    [
      ...telemetryImports(options.telemetry),
      '--import',
      'tsx',
      'scripts/benchmarks/background_write_worker.ts',
      `${options.directory}/write-plan.json`,
    ],
    {
      env: {
        ...process.env,
        BENCHMARK_COUCH_URL: url,
        ...telemetryEnvironment(options, 'eddo-benchmark-writer'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child.stdout?.on('data', (chunk) => appendFileSync(`${options.directory}/writer.log`, chunk));
  child.stderr?.on('data', (chunk) => appendFileSync(`${options.directory}/writer.log`, chunk));
  const finished = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Background writer failed; inspect writer.log')),
    );
  });
  void finished.catch(() => undefined);
  return { child, finished, plan };
}

/** Starts a separate writer after application readiness, not during preparation. */
export async function startBackgroundWrites(
  url: string,
  options: BenchmarkOptions,
): Promise<BackgroundRun | undefined> {
  if (options.background === 'control') return undefined;
  const plan = createBackgroundPlan(
    { ...options, scenario: options.background },
    generateFixture(options.profile),
  );
  const path = `${options.directory}/write-plan.json`;
  writeFileSync(path, JSON.stringify(plan));
  writeFileSync(`${options.directory}/server-writes.jsonl`, '');
  const ready = `${options.directory}/writer-ready.json`;
  rmSync(ready, { force: true });
  writeFileSync(`${options.directory}/writer.log`, '');
  const run = launchWriter(url, options, plan);
  const { child, finished } = run;
  try {
    for (let attempt = 0; attempt < 500; attempt++) {
      if (existsSync(ready)) return run;
      if (child.exitCode !== null) {
        await finished;
        throw new Error('Writer exited before readiness');
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Background writer startup timed out');
  } catch (error) {
    await stopBackgroundWrites(run);
    throw error;
  }
}

/** Verifies every acknowledged revision reached the local PouchDB, not just the server. */
export async function finishBackgroundWrites(
  run: BackgroundRun | undefined,
  session: string,
  verifyRendered: boolean = true,
): Promise<void> {
  if (!run) return;
  await run.finished;
  const receipts: WriteReceipt[] = readFileSync(`${run.plan.directory}/server-writes.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as WriteReceipt);
  const expected = receipts.flatMap((receipt) => receipt.revisions);
  if (expected.length !== run.plan.count * run.plan.batches)
    throw new Error('Background write count mismatch');
  await verifyRevisions(session, expected);
  const changes: LocalChange[] = JSON.parse(
    browser(session, ['eval', 'window.__eddoBenchmarkChanges']),
  );
  const arrivals = receipts.flatMap((receipt) =>
    receipt.revisions.map((revision) => ({
      ...revision,
      acknowledgedAt: receipt.acknowledgedAt,
      arrivedAt:
        changes.find((change) => change.id === revision.id && change.rev === revision.rev)?.at ??
        null,
    })),
  );
  if (arrivals.some((arrival) => arrival.arrivedAt === null))
    throw new Error('Missing client arrival observation for acknowledged revision');
  if (verifyRendered && run.plan.scenario === 'visible-updates')
    verifyVisibleUpdates(session, run.plan);
  writeFileSync(
    `${run.plan.directory}/background.json`,
    JSON.stringify(
      {
        plan: run.plan,
        receipts,
        arrivals,
        verifiedRevisions: expected.length,
        visibleUpdatesVerified: verifyRendered && run.plan.scenario === 'visible-updates',
      },
      null,
      2,
    ),
  );
  console.log(`background: verified ${expected.length} client revisions for ${run.plan.scenario}`);
}

/** Polls revision equality only after measured paging and the scheduled writes finish. */
async function verifyRevisions(session: string, expected: readonly LocalRevision[]): Promise<void> {
  const started = Date.now();
  const ids = expected.map((revision) => revision.id);
  while (Date.now() - started < 120000) {
    const local: LocalRevision[] = JSON.parse(
      browser(session, ['eval', `window.__eddoBenchmarkRevisions(${JSON.stringify(ids)})`]),
    );
    if (
      local.length === expected.length &&
      local.every((revision, index) => revision.rev === expected[index].rev)
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Acknowledged background revisions did not reach the client within 120s');
}

/** Checks rendered updated titles after measured navigation, without adding timing samples. */
function verifyVisibleUpdates(session: string, plan: BackgroundPlan): void {
  browser(session, ['find', 'role', 'button', 'click', '--name', 'Next period', '--exact']);
  const titles = plan.targetIds.map((id) => `Background revision 0: ${id}`);
  browser(session, [
    'wait',
    '--timeout',
    '60000',
    '--fn',
    `(() => {
    const view = document.querySelector('[data-testid="todo-view"]');
    return view?.getAttribute('data-date') === ${JSON.stringify(plan.visibleDay)} &&
      view.getAttribute('aria-busy') === 'false' && ${JSON.stringify(titles)}.every(title => view.textContent.includes(title));
  })()`,
  ]);
}

/** Stops only the harness-owned writer before resetting the next disposable view. */
export async function stopBackgroundWrites(run: BackgroundRun | undefined): Promise<void> {
  if (!run || run.child.exitCode !== null || run.child.signalCode !== null) return;
  run.child.kill('SIGTERM');
  const timer = setTimeout(() => run.child.kill('SIGKILL'), 5000);
  await run.finished.catch(() => undefined);
  clearTimeout(timer);
}
