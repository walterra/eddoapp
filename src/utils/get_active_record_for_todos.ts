import { type Todo } from '../types/todo';

export function getActiveRecordForTodos(todos: Todo[]): Todo['active'] {
  return todos.reduce<Todo['active']>((p, c) => {
    return {
      ...p,
      ...c.active,
    };
  }, {});
}
