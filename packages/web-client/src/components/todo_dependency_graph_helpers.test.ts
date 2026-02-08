import { type Todo } from '@eddo/core-shared';
import { describe, expect, it } from 'vitest';

import { selectDependencyTodos } from './todo_dependency_graph_helpers';

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

describe('selectDependencyTodos', () => {
  it('returns connected todos via parent/child relationships', () => {
    const todos = [
      createMockTodo({ _id: 'parent' }),
      createMockTodo({ _id: 'child-1', parentId: 'parent' }),
      createMockTodo({ _id: 'child-2', parentId: 'parent' }),
      createMockTodo({ _id: 'disconnected' }),
    ];

    const result = selectDependencyTodos(todos, 'parent');

    expect(result.map((todo) => todo._id).sort()).toEqual(['child-1', 'child-2', 'parent']);
  });

  it('returns connected todos via blockedBy relationships in both directions', () => {
    const todos = [
      createMockTodo({ _id: 'blocker' }),
      createMockTodo({ _id: 'blocked', blockedBy: ['blocker'] }),
      createMockTodo({ _id: 'blocked-2', blockedBy: ['blocked'] }),
      createMockTodo({ _id: 'isolated' }),
    ];

    const fromBlocked = selectDependencyTodos(todos, 'blocked');
    expect(fromBlocked.map((todo) => todo._id).sort()).toEqual(['blocked', 'blocked-2', 'blocker']);

    const fromBlocker = selectDependencyTodos(todos, 'blocker');
    expect(fromBlocker.map((todo) => todo._id).sort()).toEqual(['blocked', 'blocked-2', 'blocker']);
  });

  it('returns empty when root todo is missing', () => {
    const todos = [createMockTodo({ _id: 'todo-1' })];

    const result = selectDependencyTodos(todos, 'missing-root');

    expect(result).toEqual([]);
  });
});
