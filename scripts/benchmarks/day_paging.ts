import { CouchDBContainer } from '@testcontainers/couchdb';
import nano from 'nano';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { telemetryEnvironment, telemetryImports } from './benchmark_telemetry';
import { getOptions, type BenchmarkOptions } from './day_paging_options';

import { waitForBootstrap } from './day_paging_bootstrap';
import { browser, type PagingSample } from './day_paging_browser';
import { collectSamples } from './day_paging_collect';
import { generateFixture } from './day_paging_fixture';
import { writeReport, type BenchmarkFailure } from './day_paging_report';
import { waitForReplication } from './day_paging_warmup';

import { BENCHMARK_PASSWORD, resetBenchmarkDatabase, seedDatabase } from './day_paging_seed';

/** Reserves an available local port for the harness-owned server. */
async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Port allocation failed');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

/** Waits for the isolated server and rejects premature termination. */
async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error('Benchmark server exited; inspect server.log');
    try {
      if ((await fetch(`${url}/health`)).ok) return;
    } catch {
      /* Server is not listening yet. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Benchmark server startup timed out');
}

/** Authenticates inside the browser without exposing the synthetic JWT. */
function authenticate(session: string, options: BenchmarkOptions): void {
  browser(session, [
    'eval',
    `(async () => {
    const response = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'benchmark', password: '${BENCHMARK_PASSWORD}' }) });
    if (!response.ok) throw new Error('Synthetic login failed');
    const token = await response.json();
    localStorage.setItem('authToken', JSON.stringify(token));
    sessionStorage.setItem('eddoBenchmark', 'true');
    sessionStorage.setItem('eddoBenchmarkTelemetry', '${options.telemetry}');
    sessionStorage.setItem('eddoBenchmarkRunId', '${options.runId}');
    sessionStorage.setItem('eddoBenchmarkScenario', '${options.background}');
    return true;
  })()`,
  ]);
  browser(session, ['reload']);
}

/** Starts only the isolated benchmark backend, never development servers. */
function startServer(
  couchUrl: string,
  port: number,
  log: number,
  options: BenchmarkOptions,
): ChildProcess {
  return spawn(
    process.execPath,
    [
      ...telemetryImports(options.telemetry),
      '--import',
      'tsx',
      'packages/web-api/src/benchmarks/day_paging_server.ts',
    ],
    {
      cwd: process.cwd(),
      stdio: ['ignore', log, log],
      env: {
        ...process.env,
        COUCHDB_URL: couchUrl,
        DATABASE_PREFIX: 'eddo',
        NODE_ENV: 'production',
        PORT: String(port),
        JWT_SECRET: 'isolated-benchmark-secret-not-for-production',
        ...telemetryEnvironment(options, 'eddo-benchmark-api'),
      },
    },
  );
}

/** Stops only the harness-owned child, escalating after a bounded wait. */
async function stopServer(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Warms the real replicated browser database before measured navigation. */
async function prepareBrowser(
  session: string,
  options: BenchmarkOptions,
  url: string,
): Promise<void> {
  const docs = generateFixture(options.profile);
  const warmup = {
    session,
    totalTodos: docs.length,
    lastId: docs[docs.length - 1]._id,
    directory: options.directory,
    timeoutSeconds: options.warmupTimeout,
  };
  const firstUrl =
    options.warmupMode === 'bootstrap'
      ? `${url}/benchmark/bootstrap?telemetry=${options.telemetry ? '1' : '0'}&runId=${options.runId}&scenario=${options.background}`
      : url;
  browser(session, [...(options.headed ? ['--headed'] : []), 'open', firstUrl]);
  browser(session, ['set', 'viewport', '1440', '1000']);
  if (options.warmupMode === 'bootstrap') {
    await waitForBootstrap(warmup);
    browser(session, ['open', url]);
  } else authenticate(session, options);
  await waitForReplication(warmup);
}

/** Saves failure evidence without replacing the original error. */
function saveFailure(session: string, directory: string): void {
  try {
    writeFileSync(`${directory}/failure-snapshot.txt`, browser(session, ['snapshot']));
    writeFileSync(`${directory}/failure-errors.txt`, browser(session, ['errors']));
    writeFileSync(
      `${directory}/failure-state.json`,
      browser(session, [
        'eval',
        `JSON.stringify({
      result: window.__pagingResult, clickStartedAt: window.__pagingClickStartedAt,
      expected: window.__pagingExpected,
      ids: document.querySelector('[data-testid="todo-view"]')?.getAttribute('data-todo-ids'),
      visibility: document.visibilityState, query: window.__eddoBenchmarkQueryStatus?.(),
      date: document.querySelector('[data-testid="todo-view"]')?.getAttribute('data-date'),
      busy: document.querySelector('[data-testid="todo-view"]')?.getAttribute('aria-busy')
    })`,
      ]),
    );
  } catch {
    /* Preserve the original failure. */
  }
}

/** Recovers measurements from a view that failed after successful clicks. */
function readSavedSamples(directory: string): PagingSample[] {
  const path = `${directory}/samples.jsonl`;
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PagingSample);
}

interface BenchmarkUser {
  _id: string;
  _rev: string;
  preferences: Record<string, unknown>;
}

interface ViewResults {
  samples: PagingSample[];
  browserVersion: string;
  failures: BenchmarkFailure[];
}

/** Records flush failures separately without preventing owned browser cleanup. */
function flushBrowserTelemetry(session: string, options: BenchmarkOptions): void {
  if (!options.telemetry) return;
  try {
    browser(session, ['eval', 'window.__eddoBenchmarkFlushTelemetry?.().then(() => true)']);
  } catch {
    writeFileSync(
      `${options.directory}/telemetry-flush-error.txt`,
      'Browser telemetry flush failed; ingestion is not verified.',
    );
  }
}

/** Benchmarks each view in a fresh browser session with identical fixture data. */
async function runViews(
  couchUrl: string,
  url: string,
  options: BenchmarkOptions,
): Promise<ViewResults> {
  const registry = nano(couchUrl).db.use<BenchmarkUser>('eddo_user_registry');
  const results: ViewResults = { samples: [], browserVersion: '', failures: [] };
  for (const view of options.views) {
    await resetBenchmarkDatabase(couchUrl, options.profile);
    const user = await registry.get('user_benchmark');
    await registry.insert({
      ...user,
      preferences: {
        ...user.preferences,
        viewMode: view,
        currentDate: `${options.startDate}T12:00:00Z`,
      },
    });
    const session = `eddo-paging-${process.pid}-${view}`;
    const viewOptions = { ...options, directory: `${options.directory}/${view}` };
    mkdirSync(viewOptions.directory, { recursive: true });
    writeFileSync(`${viewOptions.directory}/samples.jsonl`, '');
    console.log(`benchmark: preparing ${view}, ${options.startDate}, ${options.steps} days`);
    try {
      await prepareBrowser(session, viewOptions, url);
      results.samples.push(...(await collectSamples(session, viewOptions, couchUrl)));
      results.browserVersion = browser(session, ['eval', 'navigator.userAgent']);
    } catch (error) {
      saveFailure(session, viewOptions.directory);
      results.samples.push(...readSavedSamples(viewOptions.directory));
      results.failures.push({
        view,
        message: error instanceof Error ? error.message : 'View benchmark failed',
      });
      console.error(`benchmark: ${view} failed; preserving samples and continuing remaining views`);
    } finally {
      try {
        flushBrowserTelemetry(session, viewOptions);
        browser(session, ['close']);
      } catch {
        /* Browser may not have started. */
      }
    }
  }
  return results;
}

/** Builds preparation assets without changing the measured production frontend. */
function buildBootstrap(options: BenchmarkOptions): void {
  if (options.warmupMode !== 'bootstrap') return;
  console.log('setup: building benchmark-only database preparation bundle');
  execFileSync(
    'pnpm',
    ['exec', 'vite', 'build', '--config', 'scripts/benchmarks/browser_bootstrap.config.ts'],
    { stdio: 'inherit' },
  );
}

/** Runs a disposable CouchDB and browser benchmark, cleaning only owned resources. */
async function main(): Promise<void> {
  const options = getOptions();
  const { profile, headed, directory, couchImage } = options;
  buildBootstrap(options);
  console.log(`setup: starting ${couchImage}`);
  const container = await new CouchDBContainer(couchImage)
    .withUsername('admin')
    .withPassword('testpassword')
    .start();
  let child: ChildProcess | undefined;
  const log = openSync(`${directory}/server.log`, 'w');
  try {
    const couchUrl = `http://admin:testpassword@${container.getHost()}:${container.getMappedPort(5984)}`;
    console.log(`setup: seeding ${profile.totalTodos} synthetic todos`);
    const fixtureHash = await seedDatabase(couchUrl, profile);
    const port = await availablePort();
    child = startServer(couchUrl, port, log, options);
    const url = `http://localhost:${port}`;
    await waitForServer(url, child);
    console.log(`setup: isolated server ready at ${url}`);
    const { samples, browserVersion, failures } = await runViews(couchUrl, url, options);
    writeReport(directory, {
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      headed,
      warmupMode: options.warmupMode,
      background: options.background,
      preparationVersion: 2,
      telemetry: options.telemetry,
      runId: options.runId,
      profile,
      fixtureHash,
      browserVersion,
      couchImage,
      samples,
      failures,
      expectedClicksPerView: options.steps * 2,
      runtime: `${process.platform}/${process.arch} Node ${process.version}`,
    });
    console.log(`Report: ${directory}/report.html`);
    if (failures.length) process.exitCode = 1;
  } finally {
    await stopServer(child);
    closeSync(log);
    await container.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
