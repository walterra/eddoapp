import { formatDuration, intervalToDuration } from 'date-fns';

import { type Todo } from '../types/todo';
import { getActiveDuration } from './get_active_duration';
import { getActiveRecordForTodos } from './get_active_record_for_todos';

const formatDistanceLocale = {
  xDays: '{{count}}d',
  xHours: '{{count}}h',
  xMinutes: '{{count}}m',
  xSeconds: '{{count}}s',
};

const shortEnLocale = {
  formatDistance: (token: keyof typeof formatDistanceLocale, count: number) =>
    formatDistanceLocale[token].replace('{{count}}', `${count}`),
};

export function getFormattedDuration(duration: number): string {
  const format = ['hours', 'minutes', 'seconds'];

  if (duration > 60000) {
    format.pop();
  }

  return formatDuration(intervalToDuration({ end: duration, start: 0 }), {
    format,
    locale: shortEnLocale,
  });
}

export function getFormattedDurationForTodos(todos: Todo[]): string {
  return getFormattedDuration(
    getActiveDuration(getActiveRecordForTodos(todos)),
  );
}
