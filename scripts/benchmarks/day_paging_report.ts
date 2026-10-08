import { writeFileSync } from 'node:fs';
import type { PagingSample } from './day_paging_browser';
import type { DayPagingProfile } from './day_paging_fixture';
import { summarizePaging, type PagingSummary } from './day_paging_summary';

import type { BackgroundScenario } from './background_write_plan';

export interface BenchmarkFailure {
  view: string;
  message: string;
}

export interface PagingReport {
  commit: string;
  headed: boolean;
  warmupMode: string;
  profile: DayPagingProfile;
  fixtureHash: string;
  browserVersion: string;
  couchImage: string;
  samples: PagingSample[];
  runtime: string;
  failures: BenchmarkFailure[];
  expectedClicksPerView: number;
  background: BackgroundScenario;
  preparationVersion: number;
  telemetry: boolean;
  runId: string;
}

/** Renders comparison rows with explicit empirical percentile labels. */
function summaryRows(summaries: readonly PagingSummary[]): string {
  return summaries
    .map((summary) => {
      const t = summary.timings;
      const values = [t.minimum, t.median, t.p75, t.p90, t.p95, t.maximum]
        .map((value) => `<td>${value.toFixed(1)}</td>`)
        .join('');
      return `<tr><td>${summary.view}</td><td>${summary.direction}</td><td>${summary.workload}</td><td>${t.count}</td>${values}</tr>`;
    })
    .join('');
}

/** Produces portable raw results, CSV, and a self-contained comparison report. */
export function writeReport(directory: string, report: PagingReport): void {
  const summaries = summarizePaging(report.samples);
  writeFileSync(`${directory}/report.json`, JSON.stringify({ ...report, summaries }, null, 2));
  const rows = report.samples
    .map(
      (sample) =>
        `<tr><td>${sample.view}</td><td>${sample.direction}</td><td>${sample.date}</td><td>${sample.todoCount}</td><td>${sample.durationMs.toFixed(1)}</td><td>${sample.longTaskMs.toFixed(1)}</td></tr>`,
    )
    .join('');
  writeCsv(directory, report.samples);
  const buckets = summaries
    .filter((summary) => summary.workload === 'all')
    .map(
      (summary) =>
        `<h3>${summary.view} / ${summary.direction}</h3><pre>${escapeHtml(JSON.stringify(summary.timings.buckets, null, 2))}</pre>`,
    )
    .join('');
  const metadata = {
    ...report,
    profile: { ...report.profile, calibration: undefined },
    samples: undefined,
  };
  writeFileSync(
    `${directory}/report.html`,
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Eddo day paging benchmark</title>
<style>body{font:16px system-ui;max-width:1200px;margin:40px auto;padding:16px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #ddd}pre{white-space:pre-wrap}</style>
<h1>Click → populated todo view</h1>
<p>Telemetry: ${report.telemetry ? 'enabled — instrumented run, not an untraced baseline' : 'disabled'}. Run ID: ${escapeHtml(report.runId)}.</p>
<p>Background scenario: ${escapeHtml(report.background)}. Server writes run independently of browser commands; see per-view background.json for acknowledged and verified client revisions. RSS additions stay outside the measured date range; visible updates preserve IDs and due dates. Preparation version ${report.preparationVersion}: bootstrap mode initializes the existing production indexes before measurement; replication mode retains application-mounted setup.</p>
<p>Status: ${report.failures.length ? 'INCOMPLETE — failures excluded from latency percentiles; inspect diagnostics' : 'complete'}. Expected ${report.expectedClicksPerView} clicks per view.</p>
${report.failures.map((failure) => `<pre>${escapeHtml(failure.view)}: ${escapeHtml(failure.message)}</pre>`).join('')}
<p>Each timing starts in the paging button click handler and ends after the requested date and exact expected todo IDs are committed, loading/placeholder state has cleared, and two animation frames have elapsed. Includes view query and rendering work. Not INP or guaranteed paint timing.</p>
<p>${report.profile.calibration ? 'Calibrated to read-only reference aggregates; see calibration.json for matched dimensions and limitations.' : 'Provisional workload: not calibrated to a reference account.'}</p>
<p>Preparation mode: ${escapeHtml(report.warmupMode)}. Fresh browser sessions per view; initial replication excluded. Production frontend and real CouchDB with a reduced backend using production auth/database proxy routes.</p>
<h2>Timing comparison (milliseconds)</h2><table><tr><th>View</th><th>Direction</th><th>Days</th><th>N</th><th>Min</th><th>Median</th><th>p75</th><th>p90</th><th>p95</th><th>Max</th></tr>${summaryRows(summaries)}</table>
<p>Percentiles describe the observed sequential daily clicks, not independent trials or field-user percentiles. Populated and empty days are separated. Reverse paging measures revisits, not guaranteed cache hits.</p>
<h2>Latency distribution</h2>${buckets}
<h2>Daily samples</h2><table><tr><th>View</th><th>Direction</th><th>Date</th><th>Todos</th><th>Populated ms</th><th>Long-task ms</th></tr>${rows}</table>
<h2>Environment</h2><pre>${escapeHtml(JSON.stringify(metadata, null, 2))}</pre></html>`,
  );
}

/** Exports raw per-click observations without summary aggregation. */
function writeCsv(directory: string, samples: readonly PagingSample[]): void {
  const csv = samples.map((sample) =>
    [
      sample.view,
      sample.direction,
      sample.date,
      sample.todoCount,
      sample.durationMs,
      sample.longTaskMs,
      sample.clickedAtEpochMs ?? '',
      sample.readyAtEpochMs ?? '',
      sample.localChanges ?? '',
      sample.fetchingAtClick ?? '',
      sample.fetchingAtReady ?? '',
    ].join(','),
  );
  writeFileSync(
    `${directory}/daily.csv`,
    [
      'view,direction,date,todos,populated_ms,long_task_ms,clicked_epoch_ms,ready_epoch_ms,local_changes,fetching_at_click,fetching_at_ready',
      ...csv,
    ].join('\n'),
  );
}

/** Escapes metadata before embedding it in HTML. */
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
