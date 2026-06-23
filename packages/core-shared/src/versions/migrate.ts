import { isTodoAlpha1 } from './todo_alpha1';
import { isTodoAlpha2, migrateToAlpha2 } from './todo_alpha2';
import { isTodoAlpha3, migrateToAlpha3 } from './todo_alpha3';
import { type TodoAlpha4, isTodoAlpha4, migrateToAlpha4 } from './todo_alpha4';

export function isLatestVersion(todo: unknown): todo is TodoAlpha4 {
  return isTodoAlpha4(todo);
}

export function migrateTodo(todo: unknown): TodoAlpha4 {
  if (isTodoAlpha1(todo)) {
    todo = migrateToAlpha2(todo);
  }

  if (isTodoAlpha2(todo)) {
    todo = migrateToAlpha3(todo);
  }

  if (isTodoAlpha3(todo)) {
    return migrateToAlpha4(todo);
  }

  if (isTodoAlpha4(todo)) {
    return todo;
  }

  throw new Error('invalid todo');
}
