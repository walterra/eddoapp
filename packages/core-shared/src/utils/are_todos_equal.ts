/**
 * Compares two todos for equality, excluding _rev
 */
import type { Todo } from '../types/todo.js';

/**
 * Compares todos excluding _rev to prevent unnecessary re-renders on save.
 * The _rev field changes on every database update but doesn't represent
 * a meaningful change to the todo content.
 * @param prev - Previous todo
 * @param next - Next todo
 * @returns True if todos are equal (ignoring _rev)
 */
export const areTodosEqual = (prev: Todo, next: Todo): boolean => {
  const { _rev: _prevRev, ...prevRest } = prev;
  const { _rev: _nextRev, ...nextRest } = next;
  return JSON.stringify(prevRest) === JSON.stringify(nextRest);
};
