import { addDays, format } from 'date-fns';

import type { Todo, NewTodo } from '../types/todo';

export function getRepeatTodo(todo: Todo): NewTodo {
  const now = new Date();
  const _id = now.toISOString();

  const { _rev, ...newTodoData } = todo;

  return {
    ...newTodoData,
    _id,
    active: {},
    completed: null,
    due: `${format(
      addDays(now, todo.repeat ?? 0),
      'yyyy-MM-dd',
    )}T23:59:59.999Z`,
  };
}
