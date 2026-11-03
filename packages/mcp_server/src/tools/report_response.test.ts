import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTimezoneDateRange } from './date-range.js';
import { briefingQueries } from './get-briefing-data.js';
import { recapQueries } from './get-recap-data.js';
import { activeReportSection, queryReportSection, type ReportSection } from './report_payload.js';
import { reportResponse, type ReportResponseOptions } from './report_response.js';
import type { GetUserDb, ToolContext } from './types.js';

vi.mock('./report_payload.js', () => ({
  queryReportSection: vi.fn(),
  activeReportSection: vi.fn(),
}));

interface DeferredSection {
  promise: Promise<ReportSection>;
  resolve: (section: ReportSection) => void;
}
interface ReportData {
  metadata: {
    counts: Record<string, number>;
    selection: Record<string, unknown>;
  };
}
interface ReportEnvelope {
  data: ReportData;
}
const context: ToolContext = {
  log: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
};
const db = {} as ReturnType<GetUserDb>;

function deferredSection(): DeferredSection {
  let resolve!: DeferredSection['resolve'];
  const promise = new Promise<ReportSection>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}
function section(total: number): ReportSection {
  return { items: [], total, returned: 0, countExact: true, truncated: total > 0 };
}

/** Controls completion order while exercising the real response serializer. */
async function response(options: ReportResponseOptions, reverse: boolean): Promise<string> {
  const pending = new Map(options.queries.map((query) => [query.name, deferredSection()]));
  vi.mocked(queryReportSection).mockClear();
  vi.mocked(queryReportSection).mockImplementation(
    (_db, query) => pending.get(query.name)!.promise,
  );
  vi.mocked(activeReportSection).mockResolvedValue(section(0));
  const result = reportResponse(options, context, () => db);
  expect(queryReportSection).toHaveBeenCalledTimes(options.queries.length);
  const order = options.queries.map((query, index) => ({ name: query.name, total: index + 1 }));
  for (const query of reverse ? [...order].reverse() : order) {
    pending.get(query.name)!.resolve(section(query.total));
    await Promise.resolve();
  }
  return result;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-03T11:29:16.164Z'));
});
afterEach(() => vi.useRealTimers());

describe('deterministic report response serialization', () => {
  it.each(['recap', 'briefing'] as const)(
    'preserves %s response bytes when queries finish in reverse order',
    async (type) => {
      const range = getTimezoneDateRange(new Date(), 'UTC');
      const options: ReportResponseOptions = {
        type,
        range,
        queries: type === 'recap' ? recapQueries(range) : briefingQueries(range),
      };
      const expected = await response(options, false);
      const reversed = await response(options, true);
      expect(reversed).toBe(expected);
      const { data } = JSON.parse(reversed) as ReportEnvelope;
      const names = options.queries.map((query) => query.name);
      expect(Object.keys(data)).toEqual([
        ...names.filter((name) => name !== 'somedayBacklog'),
        'activeTimeTracking',
        'metadata',
      ]);
      expect(Object.keys(data.metadata.counts)).toEqual([...names, 'activeTimeTracking']);
      expect(Object.keys(data.metadata.selection)).toEqual([...names, 'activeTimeTracking']);
      expect(Object.values(data.metadata.counts)).toEqual([
        ...names.map((_name, index) => index + 1),
        0,
      ]);
    },
  );
});
