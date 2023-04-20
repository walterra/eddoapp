import { describe, expect, it } from 'vitest';

import { todos } from './__mocks__/todos';

import {
  getFormattedDuration,
  getFormattedDurationForTodos,
} from './get_formatted_duration';

describe('getFormattedDuration', () => {
  it('gets 1s formatted duration', () => {
    expect(getFormattedDuration(1234)).toBe('1s');
  });

  it('gets 7h 18m formatted duration', () => {
    expect(getFormattedDuration(26290401)).toBe('7h 18m');
  });

  it('gets 1d 9h 26m formatted duration', () => {
    expect(getFormattedDuration(120382035)).toBe('1d 9h 26m');
  });

  it('gets 3d 16h 36m formatted duration', () => {
    expect(getFormattedDuration(319002424)).toBe('3d 16h 36m');
  });

  it('gets 1d formatted duration', () => {
    expect(getFormattedDuration(86400000)).toBe('1d');
  });

  it('gets 1d formatted duration, skips seconds', () => {
    expect(getFormattedDuration(86401000)).toBe('1d');
  });

  it('gets 1d 1m formatted duration', () => {
    expect(getFormattedDuration(86460000)).toBe('1d 1m');
  });
});

describe('getFormattedDurationForTodos', () => {
  it('gets duration for single todos', () => {
    expect(getFormattedDurationForTodos([todos[0]])).toBe('1s');
    expect(getFormattedDurationForTodos([todos[1]])).toBe('2d 23h 15m');
  });

  it('gets duration for multiple todos, skips seconds for display', () => {
    expect(getFormattedDurationForTodos(todos)).toBe('2d 23h 15m');
  });
});
