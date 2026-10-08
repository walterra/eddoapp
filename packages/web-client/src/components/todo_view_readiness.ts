interface ReadinessTodo {
  _id: string;
}

interface TodoViewData {
  todos: readonly ReadinessTodo[];
  isLoading: boolean;
  todosQuery: {
    isFetched: boolean;
    isPlaceholderData: boolean;
  };
}

interface TodoViewReadinessAttributes {
  'aria-busy': boolean;
  'data-testid': string;
  'data-date': string;
  'data-view': string;
  'data-todo-ids': string;
}

/** Identifies committed view data independently of hidden or virtualized rows. */
export function getTodoViewReadiness(
  date: Date,
  data: TodoViewData,
  view: 'kanban' | 'table',
): TodoViewReadinessAttributes {
  return {
    'aria-busy': data.isLoading || !data.todosQuery.isFetched || data.todosQuery.isPlaceholderData,
    'data-testid': 'todo-view',
    'data-date': date.toISOString().slice(0, 10),
    'data-view': view,
    'data-todo-ids': data.todos
      .map((todo) => todo._id)
      .sort()
      .join(','),
  };
}
