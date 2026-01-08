import { type Activity, type Todo } from '@eddo/core-client';
import { describe, expect, it } from 'vitest';

import {
  calculateDurationByContext,
  calculateTodoDurations,
  filterActivities,
  filterTodos,
} from './todo_table_helpers';

const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
  _id: '2026-01-01T00:00:00.000Z',
  _rev: '1-abc',
  title: 'Test Todo',
  description: '',
  context: 'work',
  due: '2026-01-01T23:59:59.999Z',
  tags: [],
  completed: null,
  repeat: null,
  active: {},
  link: null,
  version: 'alpha3',
  ...overrides,
});

describe('filterTodos', () => {
  describe('child todo filtering', () => {
    it('excludes todos with parentId from results', () => {
      const todos = [
        createMockTodo({ _id: 'parent-1', title: 'Parent Todo' }),
        createMockTodo({ _id: 'child-1', title: 'Child Todo', parentId: 'parent-1' }),
        createMockTodo({ _id: 'standalone', title: 'Standalone Todo' }),
      ];

      const result = filterTodos(todos, [], 'all', []);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t._id)).toEqual(['parent-1', 'standalone']);
    });

    it('includes todos with null parentId', () => {
      const todos = [
        createMockTodo({ _id: 'todo-1', parentId: null }),
        createMockTodo({ _id: 'todo-2', parentId: undefined }),
        createMockTodo({ _id: 'todo-3' }), // No parentId field
      ];

      const result = filterTodos(todos, [], 'all', []);

      expect(result).toHaveLength(3);
    });

    it('filters child todos before applying other filters', () => {
      const todos = [
        createMockTodo({ _id: 'parent', context: 'work', tags: ['important'] }),
        createMockTodo({ _id: 'child', context: 'work', tags: ['important'], parentId: 'parent' }),
      ];

      // Even though child matches all filters, it should be excluded
      const result = filterTodos(todos, ['work'], 'all', ['important']);

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('parent');
    });
  });

  describe('context filtering', () => {
    it('filters by selected contexts', () => {
      const todos = [
        createMockTodo({ _id: '1', context: 'work' }),
        createMockTodo({ _id: '2', context: 'private' }),
        createMockTodo({ _id: '3', context: 'work' }),
      ];

      const result = filterTodos(todos, ['work'], 'all', []);

      expect(result).toHaveLength(2);
      expect(result.every((t) => t.context === 'work')).toBe(true);
    });
  });

  describe('status filtering', () => {
    it('filters completed todos', () => {
      const todos = [
        createMockTodo({ _id: '1', completed: '2026-01-01T12:00:00.000Z' }),
        createMockTodo({ _id: '2', completed: null }),
      ];

      const result = filterTodos(todos, [], 'completed', []);

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('1');
    });

    it('filters incomplete todos', () => {
      const todos = [
        createMockTodo({ _id: '1', completed: '2026-01-01T12:00:00.000Z' }),
        createMockTodo({ _id: '2', completed: null }),
      ];

      const result = filterTodos(todos, [], 'incomplete', []);

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('2');
    });
  });

  describe('tag filtering', () => {
    it('filters by selected tags', () => {
      const todos = [
        createMockTodo({ _id: '1', tags: ['urgent', 'work'] }),
        createMockTodo({ _id: '2', tags: ['personal'] }),
        createMockTodo({ _id: '3', tags: ['urgent'] }),
      ];

      const result = filterTodos(todos, [], 'all', ['urgent']);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t._id)).toEqual(['1', '3']);
    });
  });
});

interface MockActivityOptions {
  todoOverrides?: Partial<Todo>;
  from?: string;
  to?: string | null;
}

const createMockActivity = (options: MockActivityOptions = {}): Activity => {
  const {
    todoOverrides = {},
    from = '2026-01-01T10:00:00.000Z',
    to = '2026-01-01T11:00:00.000Z',
  } = options;
  return {
    id: todoOverrides._id ?? '2026-01-01T00:00:00.000Z',
    from,
    to,
    doc: createMockTodo(todoOverrides),
  };
};

describe('filterActivities', () => {
  describe('child activity handling', () => {
    it('includes activities from todos with parentId (child time counts toward totals)', () => {
      const activities = [
        createMockActivity({ todoOverrides: { _id: 'parent-1', title: 'Parent Todo' } }),
        createMockActivity({
          todoOverrides: { _id: 'child-1', title: 'Child Todo', parentId: 'parent-1' },
        }),
        createMockActivity({ todoOverrides: { _id: 'standalone', title: 'Standalone Todo' } }),
      ];

      const result = filterActivities(activities, [], 'all', []);

      // All activities included - child time counts toward context total
      expect(result).toHaveLength(3);
      expect(result.map((a) => a.id)).toEqual(['parent-1', 'child-1', 'standalone']);
    });
  });

  describe('context filtering', () => {
    it('filters activities by selected contexts', () => {
      const activities = [
        createMockActivity({ todoOverrides: { _id: '1', context: 'work' } }),
        createMockActivity({ todoOverrides: { _id: '2', context: 'private' } }),
        createMockActivity({ todoOverrides: { _id: '3', context: 'work' } }),
      ];

      const result = filterActivities(activities, ['work'], 'all', []);

      expect(result).toHaveLength(2);
      expect(result.every((a) => a.doc.context === 'work')).toBe(true);
    });
  });

  describe('status filtering', () => {
    it('filters activities from completed todos', () => {
      const activities = [
        createMockActivity({
          todoOverrides: { _id: '1', completed: '2026-01-01T12:00:00.000Z' },
        }),
        createMockActivity({ todoOverrides: { _id: '2', completed: null } }),
      ];

      const result = filterActivities(activities, [], 'completed', []);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('filters activities from incomplete todos', () => {
      const activities = [
        createMockActivity({
          todoOverrides: { _id: '1', completed: '2026-01-01T12:00:00.000Z' },
        }),
        createMockActivity({ todoOverrides: { _id: '2', completed: null } }),
      ];

      const result = filterActivities(activities, [], 'incomplete', []);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
  });

  describe('tag filtering', () => {
    it('filters activities by selected tags', () => {
      const activities = [
        createMockActivity({ todoOverrides: { _id: '1', tags: ['urgent', 'work'] } }),
        createMockActivity({ todoOverrides: { _id: '2', tags: ['personal'] } }),
        createMockActivity({ todoOverrides: { _id: '3', tags: ['urgent'] } }),
      ];

      const result = filterActivities(activities, [], 'all', ['urgent']);

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual(['1', '3']);
    });
  });

  describe('combined filtering', () => {
    it('applies context, status, and tag filters (but includes child activities)', () => {
      const activities = [
        createMockActivity({
          todoOverrides: { _id: '1', context: 'work', completed: null, tags: ['urgent'] },
        }),
        createMockActivity({
          todoOverrides: {
            _id: '2',
            context: 'work',
            completed: '2026-01-01T12:00:00.000Z',
            tags: ['urgent'],
          },
        }),
        createMockActivity({
          todoOverrides: { _id: '3', context: 'private', completed: null, tags: ['urgent'] },
        }),
        createMockActivity({
          todoOverrides: { _id: '4', context: 'work', completed: null, tags: ['normal'] },
        }),
        createMockActivity({
          todoOverrides: {
            _id: '5',
            context: 'work',
            completed: null,
            tags: ['urgent'],
            parentId: '1',
          },
        }),
      ];

      const result = filterActivities(activities, ['work'], 'incomplete', ['urgent']);

      // Activities 1 and 5 match: work context, incomplete, has urgent tag
      // Activity 5 is a child but is included (child time counts toward context total)
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual(['1', '5']);
    });
  });
});

describe('calculateTodoDurations', () => {
  it('calculates own duration for todos', () => {
    const todos = [
      createMockTodo({
        _id: 'todo-1',
        active: {
          '2026-01-01T10:00:00.000Z': '2026-01-01T11:00:00.000Z', // 1 hour
        },
      }),
    ];
    const activities: Activity[] = [];

    const result = calculateTodoDurations(todos, activities, '2026-01-01', '2026-01-01');

    expect(result.get('todo-1')).toBe(3600000); // 1 hour
  });

  it('adds child activity durations to parent', () => {
    const todos = [
      createMockTodo({
        _id: 'parent-1',
        active: {
          '2026-01-01T10:00:00.000Z': '2026-01-01T11:00:00.000Z', // 1 hour own time
        },
      }),
    ];
    const activities = [
      // Child activity for parent-1
      createMockActivity({
        todoOverrides: { _id: 'child-1', parentId: 'parent-1' },
        from: '2026-01-01T12:00:00.000Z',
        to: '2026-01-01T12:30:00.000Z', // 30 min
      }),
      // Another child activity for parent-1
      createMockActivity({
        todoOverrides: { _id: 'child-2', parentId: 'parent-1' },
        from: '2026-01-01T14:00:00.000Z',
        to: '2026-01-01T14:15:00.000Z', // 15 min
      }),
    ];

    const result = calculateTodoDurations(todos, activities, '2026-01-01', '2026-01-01');

    // parent-1 should have 1h own + 30min + 15min = 1h 45min = 6300000ms
    expect(result.get('parent-1')).toBe(6300000);
  });

  it('ignores child activities for parents not in filtered list', () => {
    const todos = [createMockTodo({ _id: 'todo-1', active: {} })];
    const activities = [
      // Child activity for a different parent not in our list
      createMockActivity({
        todoOverrides: { _id: 'child-1', parentId: 'other-parent' },
        from: '2026-01-01T12:00:00.000Z',
        to: '2026-01-01T13:00:00.000Z',
      }),
    ];

    const result = calculateTodoDurations(todos, activities, '2026-01-01', '2026-01-01');

    expect(result.get('todo-1')).toBe(0);
    expect(result.has('other-parent')).toBe(false);
  });

  it('filters activities outside date range', () => {
    const todos = [createMockTodo({ _id: 'parent-1', active: {} })];
    const activities = [
      // Within range
      createMockActivity({
        todoOverrides: { _id: 'child-1', parentId: 'parent-1' },
        from: '2026-01-02T10:00:00.000Z',
        to: '2026-01-02T11:00:00.000Z', // 1 hour
      }),
      // Before range - should be excluded
      createMockActivity({
        todoOverrides: { _id: 'child-2', parentId: 'parent-1' },
        from: '2026-01-01T10:00:00.000Z',
        to: '2026-01-01T11:00:00.000Z',
      }),
    ];

    const result = calculateTodoDurations(todos, activities, '2026-01-02', '2026-01-03');

    // Only the activity within range should be counted
    expect(result.get('parent-1')).toBe(3600000); // 1 hour
  });
});

describe('calculateDurationByContext', () => {
  it('sums todo durations by context', () => {
    const todos = [
      createMockTodo({ _id: 'todo-1', context: 'work' }),
      createMockTodo({ _id: 'todo-2', context: 'work' }),
      createMockTodo({ _id: 'todo-3', context: 'private' }),
    ];
    const todoDurations = new Map([
      ['todo-1', 3600000], // 1 hour
      ['todo-2', 1800000], // 30 min
      ['todo-3', 900000], // 15 min
    ]);

    const result = calculateDurationByContext(todoDurations, todos);

    expect(result['work']).toBe('1h 30m'); // 1h + 30m
    expect(result['private']).toBe('15m');
  });

  it('uses default context for todos without context', () => {
    const todos = [createMockTodo({ _id: 'todo-1', context: '' })];
    const todoDurations = new Map([['todo-1', 60000]]); // 1 min

    const result = calculateDurationByContext(todoDurations, todos);

    // CONTEXT_DEFAULT is 'private'
    expect(result['private']).toBe('1m');
  });
});
