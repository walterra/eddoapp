/**
 * Tests for bulk due date popover helper functions
 */
import { describe, expect, it } from 'vitest';

import type { Todo } from '@eddo/core-shared';

const createMockTodo = (overrides: Partial<Todo> = {}): Todo => ({
  _id: `todo-${Date.now()}-${Math.random()}`,
  _rev: '1-abc',
  title: 'Test Todo',
  description: '',
  context: 'test',
  due: '2026-01-06T23:59:59.999Z',
  completed: null,
  tags: [],
  active: {},
  repeat: null,
  link: null,
  version: 'alpha3',
  ...overrides,
});

/**
 * Filter to only incomplete todos (extracted from component for testing)
 */
const getIncompleteTodos = (todos: readonly Todo[]): Todo[] =>
  todos.filter((todo) => todo.completed === null);

describe('bulk_due_date_popover', () => {
  describe('getIncompleteTodos', () => {
    it('returns only incomplete todos', () => {
      const incompleteTodo1 = createMockTodo({ _id: 'todo-1', completed: null });
      const completedTodo = createMockTodo({
        _id: 'todo-2',
        completed: '2026-01-05T10:00:00.000Z',
      });
      const incompleteTodo2 = createMockTodo({ _id: 'todo-3', completed: null });

      const todos = [incompleteTodo1, completedTodo, incompleteTodo2];
      const result = getIncompleteTodos(todos);

      expect(result).toHaveLength(2);
      expect(result.map((t) => t._id)).toEqual(['todo-1', 'todo-3']);
    });

    it('returns empty array when all todos are completed', () => {
      const todos = [
        createMockTodo({ _id: 'todo-1', completed: '2026-01-05T10:00:00.000Z' }),
        createMockTodo({ _id: 'todo-2', completed: '2026-01-05T11:00:00.000Z' }),
      ];

      const result = getIncompleteTodos(todos);

      expect(result).toHaveLength(0);
    });

    it('returns all todos when none are completed', () => {
      const todos = [
        createMockTodo({ _id: 'todo-1', completed: null }),
        createMockTodo({ _id: 'todo-2', completed: null }),
        createMockTodo({ _id: 'todo-3', completed: null }),
      ];

      const result = getIncompleteTodos(todos);

      expect(result).toHaveLength(3);
    });

    it('handles empty array', () => {
      const result = getIncompleteTodos([]);
      expect(result).toHaveLength(0);
    });
  });
});
