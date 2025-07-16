import { Todo } from './todo';

export interface Activity {
  doc: Todo;
  from: string;
  id: string;
  to: string;
}
