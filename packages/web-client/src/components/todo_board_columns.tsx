/**
 * Kanban column components for todo board
 */
import { type Todo, isLatestVersion } from '@eddo/core-client';
import { format } from 'date-fns';
import { uniqBy } from 'lodash-es';
import { type FC, useMemo } from 'react';

import { FormattedMessage } from './formatted_message';
import {
  type ActivityItem,
  formatActivityDurationsByDate,
  getActivityDurationForDate,
} from './todo_board_helpers';
import { TodoListElement } from './todo_list_element';

interface ContextColumnProps {
  context: string;
  contextTodos: Map<string, Array<Todo | ActivityItem>>;
  durationByContext: Record<string, string>;
  durationByContextByDate: Array<[string, Map<string, ActivityItem[]>]>;
  timeTrackingActive: string[];
}

export const ContextColumn: FC<ContextColumnProps> = ({
  context,
  contextTodos,
  durationByContext,
  durationByContextByDate,
  timeTrackingActive,
}) => {
  const todosByDate = Array.from(contextTodos).sort((a, b) => ('' + a[0]).localeCompare(b[0]));
  const activityDurationByDate = formatActivityDurationsByDate(durationByContextByDate, context);

  return (
    <div className="eddo-w-kanban" key={context}>
      <ContextHeader context={context} duration={durationByContext[context]} />
      <div className="eddo-w-kanban mb-2 space-y-2" id="kanban-list-1">
        {todosByDate.map(([todoDate, allTodosForDate]) => (
          <DateGroup
            activityDurationByDate={activityDurationByDate}
            allTodosForDate={allTodosForDate}
            context={context}
            key={`${context}_${todoDate}`}
            timeTrackingActive={timeTrackingActive}
            todoDate={todoDate}
          />
        ))}
      </div>
    </div>
  );
};

const ContextHeader: FC<{ context: string; duration: string }> = ({ context, duration }) => (
  <div className="pt-2 pb-2 text-xs font-semibold tracking-wide text-neutral-700 uppercase dark:text-neutral-300">
    <div className="flex items-center justify-between">
      <div>
        <FormattedMessage message={context} />
      </div>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{duration}</div>
    </div>
  </div>
);

interface DateGroupProps {
  context: string;
  todoDate: string;
  allTodosForDate: Array<Todo | ActivityItem>;
  activityDurationByDate: Array<[string, string]>;
  timeTrackingActive: string[];
}

const DateGroup: FC<DateGroupProps> = ({
  context,
  todoDate,
  allTodosForDate,
  activityDurationByDate,
  timeTrackingActive,
}) => {
  const todosForDate = useMemo(() => {
    const unique = uniqBy(allTodosForDate, (d) =>
      isLatestVersion(d) ? d._id : (d as ActivityItem).id,
    );
    return unique.sort((a, b) => {
      const aTitle = isLatestVersion(a) ? a.title : (a as ActivityItem).doc.title;
      const bTitle = isLatestVersion(b) ? b.title : (b as ActivityItem).doc.title;
      return ('' + aTitle).localeCompare(bTitle);
    });
  }, [allTodosForDate]);

  const displayDate = useMemo(() => {
    try {
      return format(new Date(todoDate), 'yyyy-MM-dd');
    } catch (_e) {
      return format(new Date(), 'yyyy-MM-dd');
    }
  }, [todoDate]);

  const durationForDate = getActivityDurationForDate(activityDurationByDate, displayDate);

  return (
    <div key={`${context}_${todoDate}`}>
      <DateHeader date={displayDate} duration={durationForDate} />
      {todosForDate.map((todoOrActivity) => {
        const todo = isLatestVersion(todoOrActivity)
          ? todoOrActivity
          : (todoOrActivity as ActivityItem).doc;
        return (
          <TodoListElement
            active={timeTrackingActive.some((d: string) => d === todo._id)}
            activeDate={displayDate}
            activityOnly={!isLatestVersion(todoOrActivity)}
            key={todo._id}
            timeTrackingActive={timeTrackingActive.length > 0}
            todo={todo}
          />
        );
      })}
    </div>
  );
};

const DateHeader: FC<{ date: string; duration: string }> = ({ date, duration }) => (
  <div className="mb-1 flex items-center justify-between text-xs">
    <div className="font-medium text-neutral-600 dark:text-neutral-400">{date}</div>
    <div className="text-xs text-neutral-500 dark:text-neutral-500">{duration}</div>
  </div>
);
