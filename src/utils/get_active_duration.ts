import type { Todo } from '../types/todo';

export function getActiveDuration(active: Todo['active']): number {
  return Object.entries(active).reduce((p, c) => {
    return (
      p +
      (c[1] !== null ? new Date(c[1]) : new Date()).getTime() -
      new Date(c[0]).getTime()
    );
  }, 0);
}
