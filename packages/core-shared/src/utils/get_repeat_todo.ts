import { addDays } from 'date-fns';

import type { NewTodo, Todo } from '../types/todo';

export function getRepeatTodo(todo: Todo): NewTodo {
  const now = new Date();
  const _id = now.toISOString();

  const { _rev, ...newTodoData } = todo;

  // Determine the base date for calculating the next occurrence
  // gtd:calendar - repeat from original due date (e.g., monthly bills)
  // gtd:habit or no tag - repeat from completion date (e.g., exercise habits)
  const isCalendarBased = todo.tags.includes('gtd:calendar');
  const baseDateString = isCalendarBased ? todo.due : (todo.completed ?? _id);

  // Parse the date string to get just the date part (YYYY-MM-DD)
  // and create a Date object at UTC midnight to avoid timezone issues
  const dateMatch = baseDateString.match(/^(\d{4}-\d{2}-\d{2})/);
  const baseDateOnly = dateMatch ? dateMatch[1] : baseDateString.split('T')[0];
  const baseDate = new Date(`${baseDateOnly}T00:00:00.000Z`);

  // Add the repeat days and format back to ISO string
  const newDueDate = addDays(baseDate, todo.repeat ?? 0);
  const newDueDateString = newDueDate.toISOString().split('T')[0];

  return {
    ...newTodoData,
    _id,
    active: {},
    completed: null,
    due: `${newDueDateString}T23:59:59.999Z`,
  };
}
