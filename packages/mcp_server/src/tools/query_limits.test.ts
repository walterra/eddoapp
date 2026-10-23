import { describe, expect, it } from 'vitest';

import { listTodosParameters } from './list-todos.js';
import { searchTodosParameters } from './search-todos.js';

describe('query input bounds', () => {
  it.each([0, -1, 1.5, 501])('rejects list limit %s', (limit) => {
    expect(listTodosParameters.safeParse({ limit }).success).toBe(false);
  });

  it.each([0, -1, 1.5, 101])('rejects search limit %s', (limit) => {
    expect(searchTodosParameters.safeParse({ query: 'test', limit }).success).toBe(false);
  });

  it('accepts supported query limits', () => {
    expect(listTodosParameters.safeParse({ limit: 500 }).success).toBe(true);
    expect(searchTodosParameters.safeParse({ query: 'test', limit: 100 }).success).toBe(true);
  });
});
