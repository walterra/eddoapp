import { type TodoAlpha1 } from '../versions/todo_alpha1';
import { type TodoAlpha2 } from '../versions/todo_alpha2';
import { type TodoAlpha3 } from '../versions/todo_alpha3';

/**
 * Create a TodoAlpha3 for testing without requiring _rev
 */
export function createTestTodoAlpha3(
  overrides: Partial<TodoAlpha3> & { _id: string },
): Omit<TodoAlpha3, '_rev'> {
  return {
    _id: overrides._id,
    title: overrides.title ?? 'Test Todo',
    description: overrides.description ?? '',
    completed: overrides.completed ?? null,
    due: overrides.due ?? '2025-01-02',
    context: overrides.context ?? 'test',
    repeat: overrides.repeat ?? null,
    tags: overrides.tags ?? [],
    active: overrides.active ?? {},
    externalId: overrides.externalId ?? null,
    link: overrides.link ?? null,
    version: 'alpha3',
  };
}

/**
 * Create a TodoAlpha2 for testing without requiring _rev
 */
export function createTestTodoAlpha2(
  overrides: Partial<TodoAlpha2> & { _id: string },
): Omit<TodoAlpha2, '_rev'> {
  return {
    _id: overrides._id,
    title: overrides.title ?? 'Test Todo',
    description: overrides.description ?? '',
    completed: overrides.completed ?? null,
    due: overrides.due ?? '2025-01-02',
    context: overrides.context ?? 'test',
    repeat: overrides.repeat ?? null,
    tags: overrides.tags ?? [],
    active: overrides.active ?? {},
    version: 'alpha2',
  };
}

/**
 * Create a TodoAlpha1 for testing without requiring _rev
 */
export function createTestTodoAlpha1(
  overrides: Partial<TodoAlpha1> & { _id: string },
): Omit<TodoAlpha1, '_rev'> {
  return {
    _id: overrides._id,
    title: overrides.title ?? 'Test Todo',
    completed: overrides.completed ?? false,
    context: overrides.context ?? 'test',
  };
}
