import { describe, expect, it } from 'vitest';
import {
  createBackgroundPlan,
  createIngestedTodo,
  type BackgroundScenario,
} from './background_write_plan';
import { defaultProfile, generateFixture } from './day_paging_fixture';

const docs = generateFixture({
  ...defaultProfile,
  totalTodos: 120,
  days: 30,
  referenceDate: '2026-09-01',
});
function planFor(scenario: BackgroundScenario) {
  return createBackgroundPlan(
    { scenario, startDate: '2026-09-10', steps: 12, directory: '/tmp/test' },
    docs,
  );
}

describe('background write plans', () => {
  it('keeps control free of writes', () => {
    expect(planFor('control').batches).toBe(0);
  });
  it('targets unrelated dates without changing existing IDs', () => {
    const plan = planFor('unrelated-updates');
    expect(plan.targetIds.length).toBeGreaterThan(0);
    expect(
      plan.targetIds.every((id) => {
        const doc = docs.find((todo) => todo._id === id)!;
        return doc.due < '2026-09-10' || doc.due > '2026-09-22';
      }),
    ).toBe(true);
  });
  it('selects only top-level todos on the first destination day', () => {
    const plan = planFor('visible-updates');
    expect(
      plan.targetIds.every((id) => docs.find((todo) => todo._id === id)?.due === '2026-09-11'),
    ).toBe(true);
  });
  it.each([10, 50, 200])('creates %i RSS-style offscreen documents', (count) => {
    const plan = planFor(`rss-${count}` as BackgroundScenario);
    expect(plan.count).toBe(count);
    const generated = Array.from({ length: count }, (_, index) => createIngestedTodo(plan, index));
    expect(new Set(generated.map((doc) => doc._id)).size).toBe(count);
    expect(generated.every((doc) => doc.due > '2026-09-22')).toBe(true);
    expect(generated[0].tags).toContain('source:rss');
  });
  it('schedules 120 writes across 60 one-second batches', () => {
    const plan = planFor('sustained');
    expect(plan.count * plan.batches).toBe(120);
    expect(plan.intervalMs).toBe(1000);
  });
});
