import type { PagingSample } from './day_paging_browser';

export interface TimingDistribution {
  count: number;
  minimum: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  maximum: number;
  buckets: Record<string, number>;
}

export interface PagingSummary {
  view: string;
  direction: string;
  workload: string;
  timings: TimingDistribution;
}

/** Assigns a latency bucket without modifying timing samples. */
function bucketLabel(value: number): string {
  const thresholds = [100, 200, 500, 1000, 2000, 5000];
  const labels = ['<100ms', '100–200ms', '200–500ms', '500–1000ms', '1–2s', '2–5s'];
  const index = thresholds.findIndex((threshold) => value < threshold);
  return labels[index] ?? '>=5s';
}

/** Summarizes empirical click timings with nearest-rank percentiles. */
export function timingDistribution(values: readonly number[]): TimingDistribution {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction: number): number =>
    sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  const buckets: Record<string, number> = {};
  for (const value of sorted) {
    const label = bucketLabel(value);
    buckets[label] = (buckets[label] ?? 0) + 1;
  }
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return {
    count: sorted.length,
    minimum: sorted[0] ?? 0,
    median,
    p75: percentile(0.75),
    p90: percentile(0.9),
    p95: percentile(0.95),
    maximum: sorted.at(-1) ?? 0,
    buckets,
  };
}

/** Separates empty days from populated days within one view and direction. */
function summarizeGroup(
  samples: readonly PagingSample[],
  view: string,
  direction: string,
): PagingSummary[] {
  const group = samples.filter((sample) => sample.view === view && sample.direction === direction);
  const summaries: PagingSummary[] = [];
  for (const workload of ['all', 'populated', 'empty']) {
    const selected = group.filter(
      (sample) =>
        workload === 'all' ||
        (workload === 'empty' ? sample.todoCount === 0 : sample.todoCount > 0),
    );
    if (selected.length)
      summaries.push({
        view,
        direction,
        workload,
        timings: timingDistribution(selected.map((sample) => sample.durationMs)),
      });
  }
  return summaries;
}

/** Separates views, paging directions, and populated versus empty days. */
export function summarizePaging(samples: readonly PagingSample[]): PagingSummary[] {
  const summaries: PagingSummary[] = [];
  for (const view of ['kanban', 'table']) {
    for (const direction of ['Next', 'Previous']) {
      summaries.push(...summarizeGroup(samples, view, direction));
    }
  }
  return summaries;
}
