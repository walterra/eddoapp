import { type TodoAlpha1 } from '../versions/todo_alpha1';
import { type TodoAlpha2 } from '../versions/todo_alpha2';
import { type TodoAlpha3 } from '../versions/todo_alpha3';

/** Default values for TodoAlpha3 test fixtures */
const ALPHA3_DEFAULTS: Omit<TodoAlpha3, '_id' | '_rev'> = {
  title: 'Test Todo',
  description: '',
  completed: null,
  due: '2025-01-02',
  context: 'test',
  repeat: null,
  tags: [],
  active: {},
  externalId: null,
  link: null,
  version: 'alpha3',
};

/**
 * Create a TodoAlpha3 for testing without requiring _rev
 */
export function createTestTodoAlpha3(
  overrides: Partial<TodoAlpha3> & { _id: string },
): Omit<TodoAlpha3, '_rev'> {
  return {
    ...ALPHA3_DEFAULTS,
    ...overrides,
  };
}

/** Default values for TodoAlpha2 test fixtures */
const ALPHA2_DEFAULTS: Omit<TodoAlpha2, '_id' | '_rev'> = {
  title: 'Test Todo',
  description: '',
  completed: null,
  due: '2025-01-02',
  context: 'test',
  repeat: null,
  tags: [],
  active: {},
  version: 'alpha2',
};

/**
 * Create a TodoAlpha2 for testing without requiring _rev
 */
export function createTestTodoAlpha2(
  overrides: Partial<TodoAlpha2> & { _id: string },
): Omit<TodoAlpha2, '_rev'> {
  return {
    ...ALPHA2_DEFAULTS,
    ...overrides,
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
