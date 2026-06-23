import { type TodoAlpha4 } from '../versions/todo_alpha4';

export type NewTodo = Omit<TodoAlpha4, '_rev'>;
export type Todo = TodoAlpha4;
