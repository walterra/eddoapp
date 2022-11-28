import { type TodoAlpha3 } from '../api/versions/todo_alpha3';

export type NewTodo = Omit<TodoAlpha3, '_rev'>;
export type Todo = TodoAlpha3;
