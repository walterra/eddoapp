import type { Todo } from '../types/todo';

export function getActiveDuration(active: Todo['active'], activeDate?: string): number {
  return Object.entries(active).reduce((p, c) => {
    // TODO The 'split' is a CEST quick fix
    const currentDate = c[0].split('T')[0];

    if (activeDate !== undefined && activeDate !== currentDate) {
      return p;
    }

    return p + (c[1] !== null ? new Date(c[1]) : new Date()).getTime() - new Date(c[0]).getTime();
  }, 0);
}
