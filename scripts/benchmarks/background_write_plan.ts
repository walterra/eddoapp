import { offsetDate, type SyntheticTodo } from './day_paging_fixture';

export const backgroundScenarios = [
  'control',
  'unrelated-updates',
  'visible-updates',
  'rss-10',
  'rss-50',
  'rss-200',
  'sustained',
  'catch-up-200',
  'catch-up-1000',
  'catch-up-10000',
] as const;
export type BackgroundScenario = (typeof backgroundScenarios)[number];
export interface BackgroundPlan {
  scenario: BackgroundScenario;
  delayMs: number;
  intervalMs: number;
  batches: number;
  count: number;
  targetIds: string[];
  due: string;
  visibleDay: string;
  directory: string;
}
export interface WriteRevision {
  id: string;
  rev: string;
}
export interface WriteReceipt {
  batch: number;
  startedAt: number;
  acknowledgedAt: number;
  revisions: WriteRevision[];
}
interface PlanOptions {
  scenario: BackgroundScenario;
  startDate: string;
  steps: number;
  directory: string;
}
interface WriteSchedule {
  delayMs: number;
  intervalMs: number;
  batches: number;
  count: number;
}

function createWriteSchedule(scenario: BackgroundScenario, targetCount: number): WriteSchedule {
  if (scenario === 'control') return { delayMs: 1000, intervalMs: 1000, batches: 0, count: 0 };
  if (scenario === 'sustained') return { delayMs: 1000, intervalMs: 1000, batches: 60, count: 2 };
  if (scenario.endsWith('updates')) {
    return { delayMs: 1000, intervalMs: 1000, batches: 1, count: targetCount };
  }
  const total = Number(scenario.split('-').at(-1));
  if (scenario.startsWith('catch-up-')) {
    const count = Math.min(total, 200);
    return { delayMs: 0, intervalMs: 0, batches: Math.ceil(total / count), count };
  }
  return { delayMs: 1000, intervalMs: 1000, batches: 1, count: total };
}

/** Selects deterministic writes that preserve the expected due-date ID sets. */
export function createBackgroundPlan(
  options: PlanOptions,
  docs: readonly SyntheticTodo[],
): BackgroundPlan {
  const { scenario, startDate, steps, directory } = options;
  const end = offsetDate(startDate, steps);
  const visibleDay = offsetDate(startDate, 1);
  const targets = docs
    .filter((doc) =>
      scenario === 'visible-updates'
        ? doc.due === visibleDay && !doc.parentId
        : doc.due && (doc.due < startDate || doc.due > end),
    )
    .slice(0, 10);
  const updates = scenario.endsWith('updates');
  if (updates && !targets.length) throw new Error(`No target documents for ${scenario}`);
  const schedule = createWriteSchedule(scenario, targets.length);
  return {
    scenario,
    ...schedule,
    targetIds: updates ? targets.map((doc) => doc._id) : [],
    due: offsetDate(end, 365),
    visibleDay,
    directory,
  };
}

/** Generates offscreen RSS-like documents with stable IDs and bounded payloads. */
export function createIngestedTodo(plan: BackgroundPlan, index: number): SyntheticTodo {
  return {
    _id: new Date(Date.UTC(2040, 0, 1) + index * 1000).toISOString(),
    version: 'alpha4',
    title: `Background RSS item ${index}`,
    description: 'Synthetic RSS content. '.repeat(50),
    due: plan.due,
    context: 'read-later',
    tags: ['gtd:someday', 'source:rss'],
    active: {},
    completed: null,
    repeat: null,
    link: null,
    notes: [],
    metadata: { 'benchmark:batch': String(index) },
    scheduledTime: null,
    scheduledTimeZone: null,
  };
}
