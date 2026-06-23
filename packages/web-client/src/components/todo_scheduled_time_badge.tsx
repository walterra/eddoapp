import { formatScheduledTimeForTimeZone, type Todo } from '@eddo/core-client';
import { type FC } from 'react';

import { useUserTimeZone } from '../hooks/use_user_timezone';

const getDayOffsetLabel = (dayOffset: -1 | 0 | 1): string => {
  if (dayOffset === 0) return '';
  return dayOffset === 1 ? ' +1d' : ' -1d';
};

interface TodoScheduledTimeBadgeProps {
  className: string;
  todo: Todo;
}

/** Renders scheduled time converted into the active UI timezone. */
export const TodoScheduledTimeBadge: FC<TodoScheduledTimeBadgeProps> = ({ className, todo }) => {
  const displayTimeZone = useUserTimeZone();
  if (!todo.scheduledTime) return null;

  const scheduledTime = formatScheduledTimeForTimeZone(
    todo.due,
    todo.scheduledTime,
    todo.scheduledTimeZone,
    displayTimeZone,
  );

  return (
    <span className={className} title={`Scheduled in ${scheduledTime.timeZone}`}>
      {scheduledTime.time}
      {getDayOffsetLabel(scheduledTime.dayOffset)}
    </span>
  );
};
