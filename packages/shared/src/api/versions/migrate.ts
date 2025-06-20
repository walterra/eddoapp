import { isTodoAlpha1 } from './todo_alpha1';
import { isTodoAlpha2, migrateToAlpha2 } from './todo_alpha2';
import { type TodoAlpha3, isTodoAlpha3, migrateToAlpha3 } from './todo_alpha3';

export function isLatestVersion(todo: unknown): todo is TodoAlpha3 {
  return isTodoAlpha3(todo);
}

export function migrateTodo(todo: unknown): TodoAlpha3 {
  if (isTodoAlpha1(todo)) {
    todo = migrateToAlpha2(todo);
  }

  if (isTodoAlpha2(todo)) {
    return migrateToAlpha3(todo);
  }

  if (isTodoAlpha3(todo)) {
    return todo;
  }

  throw new Error('invalid todo');
}
