import type { TodoAlpha4 } from '@eddo/core-server';
import type { MangoQuery } from 'nano';
import type { GetUserDb } from './types.js';

export interface ReportItem {
  id: string;
  title: string;
  context: string;
  due: string;
  completed: string | null;
  tags: string[];
  scheduledTime?: string | null;
  scheduledTimeZone?: string | null;
  trackedMinutes: number;
  activeSessionCount: number;
  fieldsTruncated: boolean;
}

export interface ReportSection {
  items: ReportItem[];
  total: number;
  countExact: boolean;
  returned: number;
  truncated: boolean;
}

export interface ReportQuery {
  name: string;
  query: MangoQuery;
  limit: number;
}

const FIELDS = [
  '_id',
  'title',
  'context',
  'due',
  'completed',
  'tags',
  'scheduledTime',
  'scheduledTimeZone',
  'active',
];

/** Summarizes time entries without exposing their unbounded timestamp map. */
function tracking(
  todo: TodoAlpha4,
  now: number,
): Pick<ReportItem, 'trackedMinutes' | 'activeSessionCount'> {
  let milliseconds = 0;
  let activeSessionCount = 0;
  for (const [start, end] of Object.entries(todo.active ?? {})) {
    if (end === null) activeSessionCount += 1;
    const elapsed = (end === null ? now : Date.parse(end)) - Date.parse(start);
    if (Number.isFinite(elapsed) && elapsed > 0) milliseconds += elapsed;
  }
  return { trackedMinutes: Math.round(milliseconds / 60_000), activeSessionCount };
}

/** Projects only bounded fields needed to discuss and schedule work. */
export function reportItem(todo: TodoAlpha4, now: number): ReportItem {
  const tags = (todo.tags ?? []).slice(0, 6).map((tag) => tag.slice(0, 48));
  return {
    id: todo._id.slice(0, 80),
    title: todo.title.slice(0, 160),
    context: todo.context.slice(0, 80),
    due: todo.due.slice(0, 32),
    completed: todo.completed,
    tags,
    scheduledTime: todo.scheduledTime,
    scheduledTimeZone: todo.scheduledTimeZone,
    ...tracking(todo, now),
    fieldsTruncated:
      todo.title.length > 160 ||
      todo.context.length > 80 ||
      todo._id.length > 80 ||
      (todo.tags ?? []).some((tag) => tag.length > 48) ||
      (todo.tags ?? []).length > 6,
  };
}

/** Fetches projected pages, retaining bounded candidates and explicitly qualifying partial counts. */
export async function queryReportSection(
  db: ReturnType<GetUserDb>,
  definition: ReportQuery,
  now: number,
): Promise<ReportSection> {
  const items: ReportItem[] = [];
  let total = 0;
  let bookmark: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 100; page += 1) {
    const response = await db.find({
      ...definition.query,
      fields: FIELDS,
      limit: 200,
      ...(bookmark ? { bookmark } : {}),
    });
    for (const todo of response.docs as TodoAlpha4[]) {
      if (seen.has(todo._id)) continue;
      seen.add(todo._id);
      total += 1;
      if (definition.name === 'calendarToday') {
        items.push(reportItem(todo, now));
        items.sort((a, b) =>
          (a.scheduledTime ?? '99:99').localeCompare(b.scheduledTime ?? '99:99'),
        );
        items.splice(definition.limit);
      } else if (items.length < definition.limit) items.push(reportItem(todo, now));
    }
    if (response.docs.length < 200) return section(items, total, true);
    if (!response.bookmark || response.bookmark === bookmark) return section(items, total, false);
    bookmark = response.bookmark;
  }
  return section(items, total, false);
}

function section(items: ReportItem[], total: number, countExact: boolean): ReportSection {
  return {
    items,
    total,
    countExact,
    returned: items.length,
    truncated: !countExact || total > items.length,
  };
}

/** Returns active sessions without duplicating documents emitted once per session. */
export async function activeReportSection(
  db: ReturnType<GetUserDb>,
  now: number,
): Promise<ReportSection> {
  const response = await db.view('todos_by_time_tracking_active', 'byTimeTrackingActive', {
    include_docs: true,
  });
  const todos = new Map<string, TodoAlpha4>();
  for (const row of response.rows) {
    const todo = row.doc as TodoAlpha4 | undefined;
    if (todo) todos.set(todo._id, todo);
  }
  return section(
    [...todos.values()].map((todo) => reportItem(todo, now)),
    todos.size,
    true,
  );
}
