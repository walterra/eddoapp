import {
  type Duration,
  type FormatDistanceToken,
  formatDuration,
  intervalToDuration,
} from 'date-fns';

import { type Activity } from '../types/activity';
import { type Todo } from '../types/todo';
import { getActiveDuration } from './get_active_duration';
import { getActiveRecordForActivities } from './get_active_record_for_activities';
import { getActiveRecordForTodos } from './get_active_record_for_todos';

const formatDistanceLocale: Record<string, string> = {
  xDays: '{{count}}d',
  xHours: '{{count}}h',
  xMinutes: '{{count}}m',
  xSeconds: '{{count}}s',
};

const shortEnLocale = {
  formatDistance: (token: FormatDistanceToken, count: number) => {
    const template = formatDistanceLocale[token];
    return template ? template.replace('{{count}}', `${count}`) : `${count}`;
  },
};

export function getFormattedDuration(duration: number): string {
  const format: (keyof Duration)[] = ['days', 'hours', 'minutes', 'seconds'];

  if (duration > 60000) {
    format.pop();
  }

  return formatDuration(intervalToDuration({ end: duration, start: 0 }), {
    format,
    locale: shortEnLocale,
  });
}

export function getFormattedDurationForTodos(todos: Todo[]): string {
  return getFormattedDuration(getActiveDuration(getActiveRecordForTodos(todos)));
}

export function getFormattedDurationForActivities(activities: Activity[]): string {
  return getFormattedDuration(getActiveDuration(getActiveRecordForActivities(activities)));
}
