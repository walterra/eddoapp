import { execFileSync } from 'node:child_process';

export interface PagingSample {
  direction: string;
  date: string;
  view: string;
  todoCount: number;
  durationMs: number;
  longTaskMs: number;
  resourceCount: number;
  heapBytes: number | null;
  clickedAtEpochMs?: number;
  readyAtEpochMs?: number;
  localChanges?: number;
  fetchingAtClick?: number | null;
  fetchingAtReady?: number | null;
}

/** Runs agent-browser without shell interpolation. */
export function browser(session: string, args: string[]): string {
  return execFileSync('agent-browser', ['--session', session, ...args], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
}

/** Installs browser-local observation without logging account contents. */
export function installObservers(session: string): void {
  browser(session, [
    'eval',
    `(() => {
    window.__pagingLongTasks = [];
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__pagingLongTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: false });
    performance.setResourceTimingBufferSize(10000);
    return true;
  })()`,
  ]);
}

/** Builds the shared exact-date, exact-ID, nonloading readiness predicate. */
function readinessPredicate(date: string, ids: readonly string[]): string {
  return `(() => {
    const board = document.querySelector('[data-testid="todo-view"]');
    return board?.getAttribute('data-date') === ${JSON.stringify(date)} &&
      board.getAttribute('aria-busy') === 'false' &&
      board.getAttribute('data-todo-ids') === ${JSON.stringify([...ids].sort().join(','))};
  })`;
}

/** Waits for committed view data, not replication network idleness. */
export function waitForDay(session: string, ids: string[], date: string): void {
  browser(session, ['wait', '--timeout', '60000', '--fn', `${readinessPredicate(date, ids)}()`]);
}

/** Defines result fields evaluated inside the browser's click measurement closure. */
function resultPayload(direction: string, date: string, count: number): string {
  return `{
    direction: ${JSON.stringify(direction)}, date: ${JSON.stringify(date)},
    view: document.querySelector('[data-testid="todo-view"]').getAttribute('data-view'), todoCount: ${count},
    durationMs: performance.now() - start,
    clickedAtEpochMs: performance.timeOrigin + start,
    readyAtEpochMs: performance.timeOrigin + performance.now(),
    localChanges: (window.__eddoBenchmarkChanges ?? []).filter(change => change.at >= performance.timeOrigin + start && change.at <= Date.now()).length,
    fetchingAtClick, fetchingAtReady: window.__eddoBenchmarkQueryStatus?.().fetching ?? null,
    longTaskMs: window.__pagingLongTasks.filter(task => task.start >= start).reduce((sum, task) => sum + task.duration, 0),
    resourceCount: performance.getEntriesByType('resource').length - initialResources,
    heapBytes: performance.memory?.usedJSHeapSize ?? null
  }`;
}

/** Delegates capture to document so background renders cannot replace the armed button. */
function armPagingMeasurement(
  session: string,
  direction: string,
  date: string,
  ids: string[],
): void {
  browser(session, [
    'eval',
    `(() => {
    window.__pagingResult = null;
    window.__pagingClickStartedAt = null;
    window.__pagingExpected = { date: ${JSON.stringify(date)}, ids: ${JSON.stringify([...ids].sort())} };
    const isReady = ${readinessPredicate(date, ids)};
    const onClick = event => {
      if (!event.isTrusted || event.target?.closest?.('[aria-label]')?.getAttribute('aria-label') !== ${JSON.stringify(`${direction} period`)}) return;
      document.removeEventListener('click', onClick, true);
      const start = performance.now();
      window.__pagingClickStartedAt = performance.timeOrigin + start;
      const fetchingAtClick = window.__eddoBenchmarkQueryStatus?.().fetching ?? null;
      const initialResources = performance.getEntriesByType('resource').length;
      const timer = setTimeout(() => {
        if (window.__pagingResult === null) window.__pagingResult = { error: 'Content readiness timed out' };
      }, 60000);
      const check = () => {
        if (window.__pagingResult !== null) return;
        if (!isReady()) { requestAnimationFrame(check); return; }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (window.__pagingResult !== null) return;
          if (!isReady()) { requestAnimationFrame(check); return; }
          clearTimeout(timer);
          window.__pagingResult = ${resultPayload(direction, date, ids.length)};
        }));
      };
      requestAnimationFrame(check);
    };
    document.addEventListener('click', onClick, true);
    return true;
  })()`,
  ]);
}

/** Measures a trusted UI click through exact committed data and two animation frames. */
export function pageDay(
  session: string,
  direction: string,
  date: string,
  ids: string[],
): PagingSample {
  armPagingMeasurement(session, direction, date, ids);
  browser(session, ['find', 'role', 'button', 'click', '--name', `${direction} period`, '--exact']);
  browser(session, ['wait', '--timeout', '90000', '--fn', 'window.__pagingResult !== null']);
  return readPagingResult(session);
}

/** Decodes readiness failures without treating them as timing samples. */
function readPagingResult(session: string): PagingSample {
  const output = browser(session, ['eval', 'JSON.stringify(window.__pagingResult)']);
  const decoded: unknown = JSON.parse(output);
  const result = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
  if (result.error) throw new Error(result.error);
  return result as PagingSample;
}
