import { describe, expect, it } from 'vitest';
import type { PagingSample } from './day_paging_browser';
import { summarizePaging, timingDistribution } from './day_paging_summary';

describe('paging timing summaries', () => {
  it('reports min, median, maximum, and nearest-rank percentiles', () => {
    const summary = timingDistribution(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(summary).toMatchObject({
      count: 100,
      minimum: 1,
      median: 50.5,
      p75: 75,
      p90: 90,
      p95: 95,
      maximum: 100,
    });
  });
  it('handles empty input without NaN', () => {
    expect(timingDistribution([])).toMatchObject({ count: 0, minimum: 0, median: 0, maximum: 0 });
  });
  it('separates views, directions, and empty days', () => {
    const base: PagingSample = {
      view: 'kanban',
      direction: 'Next',
      date: '2026-10-05',
      todoCount: 1,
      durationMs: 100,
      longTaskMs: 0,
      resourceCount: 0,
      heapBytes: null,
    };
    const summaries = summarizePaging([
      base,
      { ...base, view: 'table', todoCount: 0, durationMs: 200 },
    ]);
    expect(
      summaries.find((row) => row.view === 'kanban' && row.workload === 'populated')?.timings
        .median,
    ).toBe(100);
    expect(
      summaries.find((row) => row.view === 'table' && row.workload === 'empty')?.timings.median,
    ).toBe(200);
  });
});
