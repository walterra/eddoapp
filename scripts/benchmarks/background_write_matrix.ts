import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { backgroundScenarios, type BackgroundScenario } from './background_write_plan';
import { offsetDate } from './day_paging_fixture';
import { option } from './day_paging_options';
import type { PagingReport } from './day_paging_report';
import { summarizePaging } from './day_paging_summary';

interface MatrixResult {
  scenario: string;
  view: string;
  completed: boolean;
  samples: number;
  localChangesDuringClicks: number;
  summaries: ReturnType<typeof summarizePaging>;
  report: string;
}

interface MatrixOptions {
  steps: string;
  startDate: string;
  profile: string;
}

/** Runs one isolated benchmark and preserves its diagnostic log on failure. */
function invokeBenchmark(
  output: string,
  scenario: BackgroundScenario,
  view: string,
  options: MatrixOptions,
): boolean {
  const log = openSync(`${output}/run.log`, 'w');
  try {
    execFileSync(
      'pnpm',
      [
        'benchmark:day-paging',
        '--profile',
        options.profile,
        '--steps',
        options.steps,
        '--start-date',
        options.startDate,
        '--background',
        scenario,
        '--views',
        view,
        '--output',
        output,
        ...(process.argv.includes('--headed') ? ['--headed'] : []),
      ],
      { stdio: ['ignore', log, log], timeout: 600000 },
    );
    return true;
  } catch {
    process.exitCode = 1;
    return false;
  } finally {
    closeSync(log);
  }
}

/** Reuses completed cases only when their fixture, protocol, and paging settings match. */
function readResumeResults(directory: string, options: MatrixOptions): MatrixResult[] {
  const path = `${directory}/report.json`;
  if (!existsSync(path)) return [];
  if (!process.argv.includes('--resume'))
    throw new Error('Output already contains a matrix; use --resume or a fresh directory');
  const results: MatrixResult[] = JSON.parse(readFileSync(path, 'utf8'));
  const profile = JSON.parse(readFileSync(options.profile, 'utf8'));
  for (const result of results.filter((result) => result.completed)) {
    const report: PagingReport = JSON.parse(
      readFileSync(`${directory}/${result.report.replace('.html', '.json')}`, 'utf8'),
    );
    if (
      report.preparationVersion !== 2 ||
      report.expectedClicksPerView !== Number(options.steps) * 2 ||
      report.samples[0]?.date !== offsetDate(options.startDate, 1) ||
      report.headed !== process.argv.includes('--headed') ||
      JSON.stringify(report.profile) !== JSON.stringify(profile)
    )
      throw new Error('Resume settings differ from the completed matrix cases');
  }
  return results.filter((result) => result.completed);
}

/** Reads completed timing results or retains a link to startup failure diagnostics. */
function readCaseResult(
  directory: string,
  label: string,
  view: string,
  completed: boolean,
): MatrixResult {
  const output = `${directory}/${label}/${view}`;
  if (!existsSync(`${output}/report.json`))
    return {
      scenario: label,
      view,
      completed: false,
      samples: 0,
      localChangesDuringClicks: 0,
      summaries: [],
      report: `${label}/${view}/run.log`,
    };
  const report: PagingReport = JSON.parse(readFileSync(`${output}/report.json`, 'utf8'));
  return {
    scenario: label,
    view,
    completed: completed && !report.failures.length,
    samples: report.samples.length,
    localChangesDuringClicks: report.samples.reduce(
      (sum, sample) => sum + (sample.localChanges ?? 0),
      0,
    ),
    summaries: summarizePaging(report.samples),
    report: `${label}/${view}/report.html`,
  };
}

/** Runs each view with a fresh container and browser; repeats controls at both ends. */
function main(): void {
  const directory = resolve(
    option('--output', `benchmark-results/background-writes-${Date.now()}`),
  );
  mkdirSync(directory, { recursive: true });
  const steps = option('--steps', '12');
  const startDate = option('--start-date', '2026-07-05');
  const profile = option('--profile', 'benchmark-results/reference/walterra-profile.json');
  const cases = [
    ...backgroundScenarios.map((scenario) => ({ label: scenario, scenario })),
    { label: 'control-repeat', scenario: 'control' as const },
  ];
  const results = readResumeResults(directory, { steps, startDate, profile });
  for (const test of cases)
    for (const view of ['kanban', 'table']) {
      if (results.some((result) => result.scenario === test.label && result.view === view))
        continue;
      const output = `${directory}/${test.label}/${view}`;
      if (process.argv.includes('--resume') && existsSync(output))
        renameSync(output, `${output}-interrupted-${Date.now()}`);
      mkdirSync(output, { recursive: true });
      console.log(`matrix: ${test.label}/${view}, ${steps} days forward and reverse`);
      const completed = invokeBenchmark(output, test.scenario, view, { steps, startDate, profile });
      results.push(readCaseResult(directory, test.label, view, completed));
      writeMatrix(directory, results);
    }
  console.log(`Matrix report: ${directory}/report.html`);
}

/** Links detailed reports and preserves controls instead of pooling different workloads. */
function writeMatrix(directory: string, results: readonly MatrixResult[]): void {
  writeFileSync(`${directory}/report.json`, JSON.stringify(results, null, 2));
  const rows = results
    .flatMap((result) =>
      result.summaries
        .filter((summary) => summary.workload === 'all')
        .map(
          (summary) =>
            `<tr><td><a href="${result.report}">${result.scenario}</a></td><td>${result.view}</td><td>${summary.direction}</td><td>${result.completed ? 'complete' : 'INCOMPLETE'}</td><td>${summary.timings.count}</td><td>${summary.timings.median.toFixed(1)}</td><td>${summary.timings.p95.toFixed(1)}</td><td>${summary.timings.maximum.toFixed(1)}</td><td>${result.localChangesDuringClicks}</td></tr>`,
        ),
    )
    .join('');
  writeFileSync(
    `${directory}/report.html`,
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Background-write paging comparison</title>
<style>body{font:16px system-ui;max-width:1200px;margin:40px auto}td,th{padding:8px;text-align:left;border-bottom:1px solid #ddd}table{border-collapse:collapse}</style>
<h1>Background-write paging comparison</h1><p>${results.filter((result) => result.completed).length}/${results.length} case/view runs complete.</p>
<ul>${results
      .filter((result) => !result.completed)
      .map(
        (result) =>
          `<li>INCOMPLETE: <a href="${result.report}">${result.scenario}/${result.view}</a></li>`,
      )
      .join(
        '',
      )}</ul><p>Fresh CouchDB container and browser for each case/view. Resumes retain interrupted attempts in sibling directories. Controls run before and after the write cases. No traces. Small sequential samples are diagnostic, not statistically independent trials.</p>
<p>Writes start one second after writer readiness. RSS-like additions are offscreen. Sustained ingestion writes two documents per second for 60 seconds; its tail can outlast measured navigation. Local changes counts cover click intervals only, across both directions. Click-through reports include CSVs and verified revision arrival timestamps.</p>
<table><tr><th>Scenario</th><th>View</th><th>Direction</th><th>Status</th><th>N</th><th>Median ms</th><th>p95 ms</th><th>Max ms</th><th>Local changes during clicks</th></tr>${rows}</table></html>`,
  );
}
main();
