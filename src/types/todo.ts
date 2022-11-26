import { type TodoAlpha2 } from '../api/versions/todo_alpha2';

export type NewTodo = Omit<TodoAlpha2, '_rev'>;
export type Todo = TodoAlpha2;
