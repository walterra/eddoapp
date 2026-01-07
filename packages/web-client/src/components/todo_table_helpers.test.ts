import { type Todo } from '@eddo/core-client';
import { describe, expect, it } from 'vitest';

import { filterTodos } from './todo_table_helpers';

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
