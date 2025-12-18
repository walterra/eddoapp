import { describe, expect, it } from 'vitest';

import type { Todo } from '../types/todo';
import { getRepeatTodo } from './get_repeat_todo';

describe('getRepeatTodo', () => {
  const baseTodo: Todo = {
    _id: '2025-01-10T10:00:00.000Z',
    _rev: '1-abc',
    active: {},
    completed: '2025-01-15T14:30:00.000Z',
    context: 'private',
    description: 'Test todo',
    due: '2025-01-10T23:59:59.999Z',
    link: null,
    repeat: 7,
    tags: [],
    title: 'Test Todo',
    version: 'alpha3',
  };

  describe('gtd:calendar tag behavior', () => {
    it('repeats from original due date when gtd:calendar tag is present', () => {
      const calendarTodo: Todo = {
        ...baseTodo,
        tags: ['gtd:calendar'],
        repeat: 7,
        due: '2025-01-10T23:59:59.999Z', // Original due date
        completed: '2025-01-15T14:30:00.000Z', // Completed 5 days late
      };

      const result = getRepeatTodo(calendarTodo);

      // Should be 7 days from Jan 10, not from Jan 15
      expect(result.due).toBe('2025-01-17T23:59:59.999Z');
      expect(result.completed).toBeNull();
      expect(result.active).toEqual({});
      expect(result.tags).toEqual(['gtd:calendar']);
      expect(result.repeat).toBe(7);
    });

    it('works with multiple tags including gtd:calendar', () => {
      const calendarTodo: Todo = {
        ...baseTodo,
        tags: ['work', 'gtd:calendar', 'bills'],
        repeat: 30,
        due: '2025-01-15T23:59:59.999Z',
      };

      const result = getRepeatTodo(calendarTodo);

      // Should be 30 days from Jan 15
      expect(result.due).toBe('2025-02-14T23:59:59.999Z');
    });

    it('handles zero repeat days with gtd:calendar tag', () => {
      const calendarTodo: Todo = {
        ...baseTodo,
        tags: ['gtd:calendar'],
        repeat: 0,
        due: '2025-01-10T23:59:59.999Z',
      };

      const result = getRepeatTodo(calendarTodo);

      // Should be same as original due date
      expect(result.due).toBe('2025-01-10T23:59:59.999Z');
    });
  });

  describe('gtd:habit tag behavior', () => {
    it('repeats from completion date when gtd:habit tag is present', () => {
      const habitTodo: Todo = {
        ...baseTodo,
        tags: ['gtd:habit'],
        repeat: 3,
        due: '2025-01-10T23:59:59.999Z',
        completed: '2025-01-15T14:30:00.000Z',
      };

      const result = getRepeatTodo(habitTodo);

      // Should be 3 days from Jan 15 (completion date)
      expect(result.due).toBe('2025-01-18T23:59:59.999Z');
      expect(result.tags).toEqual(['gtd:habit']);
    });

    it('works with multiple tags including gtd:habit', () => {
      const habitTodo: Todo = {
        ...baseTodo,
        tags: ['health', 'gtd:habit', 'exercise'],
        repeat: 2,
        completed: '2025-01-15T14:30:00.000Z',
      };

      const result = getRepeatTodo(habitTodo);

      // Should be 2 days from completion date (Jan 15)
      expect(result.due).toBe('2025-01-17T23:59:59.999Z');
    });
  });

  describe('default behavior (no tag or other tags)', () => {
    it('defaults to habit behavior when no gtd tag is present', () => {
      const noTagTodo: Todo = {
        ...baseTodo,
        tags: [],
        repeat: 5,
        due: '2025-01-10T23:59:59.999Z',
        completed: '2025-01-15T14:30:00.000Z',
      };

      const result = getRepeatTodo(noTagTodo);

      // Should behave like habit - 5 days from completion date
      expect(result.due).toBe('2025-01-20T23:59:59.999Z');
    });

    it('defaults to habit behavior with other tags (not gtd:calendar)', () => {
      const otherTagsTodo: Todo = {
        ...baseTodo,
        tags: ['work', 'gtd:next'],
        repeat: 7,
        due: '2025-01-10T23:59:59.999Z',
        completed: '2025-01-15T14:30:00.000Z',
      };

      const result = getRepeatTodo(otherTagsTodo);

      // Should behave like habit - 7 days from completion date
      expect(result.due).toBe('2025-01-22T23:59:59.999Z');
    });
  });

  describe('edge cases', () => {
    it('handles null repeat value', () => {
      const noRepeatTodo: Todo = {
        ...baseTodo,
        tags: ['gtd:calendar'],
        repeat: null,
      };

      const result = getRepeatTodo(noRepeatTodo);

      // Should use 0 days when repeat is null
      expect(result.repeat).toBeNull();
    });

    it('preserves all todo properties except _rev, active, and completed', () => {
      const fullTodo: Todo = {
        ...baseTodo,
        tags: ['gtd:calendar', 'work', 'important'],
        context: 'work',
        description: 'Detailed description',
        link: 'https://example.com',
        title: 'Important Task',
      };

      const result = getRepeatTodo(fullTodo);

      expect('_rev' in result).toBe(false);
      expect(result.active).toEqual({});
      expect(result.completed).toBeNull();
      expect(result.tags).toEqual(['gtd:calendar', 'work', 'important']);
      expect(result.context).toBe('work');
      expect(result.description).toBe('Detailed description');
      expect(result.link).toBe('https://example.com');
      expect(result.title).toBe('Important Task');
    });

    it('generates new _id as ISO timestamp', () => {
      const result = getRepeatTodo(baseTodo);

      expect(result._id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result._id).not.toBe(baseTodo._id);
    });

    it('always formats due date with end-of-day time', () => {
      const calendarTodo: Todo = {
        ...baseTodo,
        tags: ['gtd:calendar'],
        repeat: 1,
        due: '2025-01-10T23:59:59.999Z',
      };

      const result = getRepeatTodo(calendarTodo);

      expect(result.due).toMatch(/T23:59:59\.999Z$/);
    });
  });

  describe('calendar vs habit precedence', () => {
    it('prefers gtd:calendar when both calendar and habit tags are present', () => {
      const bothTagsTodo: Todo = {
        ...baseTodo,
        tags: ['gtd:calendar', 'gtd:habit'],
        repeat: 7,
        due: '2025-01-10T23:59:59.999Z',
        completed: '2025-01-15T14:30:00.000Z',
      };

      const result = getRepeatTodo(bothTagsTodo);

      // gtd:calendar should take precedence - 7 days from due date (Jan 10)
      expect(result.due).toBe('2025-01-17T23:59:59.999Z');
    });
  });
});
