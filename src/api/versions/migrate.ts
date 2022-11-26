import { isTodoAlpha1 } from './todo_alpha1';
import { isTodoAlpha2, migrateToAlpha2, type TodoAlpha2 } from './todo_alpha2';

export function isLatestVersion(todo: unknown): boolean {
  return isTodoAlpha2(todo);
}

export function migrateTodo(todo: unknown): TodoAlpha2 {
  if (isTodoAlpha1(todo)) {
    return migrateToAlpha2(todo);
  }

  if (isTodoAlpha2(todo)) {
    return todo;
  }

  throw new Error('invalid todo');
}
