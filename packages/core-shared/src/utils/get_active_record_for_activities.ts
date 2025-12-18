import type { Activity } from '../types/activity';
import type { Todo } from '../types/todo';

export function getActiveRecordForActivities(activities: Activity[]): Todo['active'] {
  return activities.reduce<Todo['active']>((p, activity) => {
    return {
      ...p,
      [activity.from]: activity.to,
    };
  }, {});
}
