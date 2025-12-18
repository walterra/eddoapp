import { type DatabaseError, DatabaseErrorType, NewTodo } from '@eddo/core-client';
import { add, format, getISOWeek, sub } from 'date-fns';
import { Button, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';

import { CONTEXT_DEFAULT } from '../constants';
import { useEddoContexts } from '../hooks/use_eddo_contexts';
import { useTags } from '../hooks/use_tags';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorMessage } from './database_error_message';
import { EddoContextFilter } from './eddo_context_filter';
import type { CompletionStatus } from './status_filter';
import { StatusFilter } from './status_filter';
import { TagFilter } from './tag_filter';
import { TagInput } from './tag_input';
import type { TimeRange } from './time_range_filter';
import { TimeRangeFilter } from './time_range_filter';

interface AddTodoProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  selectedContexts: string[];
  setSelectedContexts: (contexts: string[]) => void;
  selectedStatus: CompletionStatus;
  setSelectedStatus: (status: CompletionStatus) => void;
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: (timeRange: TimeRange) => void;
}

export const AddTodo: FC<AddTodoProps> = ({
  currentDate,
  setCurrentDate,
  selectedTags,
  setSelectedTags,
  selectedContexts,
  setSelectedContexts,
  selectedStatus,
  setSelectedStatus,
  selectedTimeRange,
  setSelectedTimeRange,
}) => {
  const { safeDb } = usePouchDb();
  const { allTags } = useTags();
  const { allContexts } = useEddoContexts();

  const [todoContext, setTodoContext] = useState(CONTEXT_DEFAULT);
  const [todoDue, setTodoDue] = useState(new Date().toISOString().split('T')[0]);
  const [todoLink, setTodoLink] = useState('');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoTags, setTodoTags] = useState<string[]>([]);
  const [error, setError] = useState<DatabaseError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCalendarWeek = getISOWeek(currentDate);

  function getPeriodLabel(): string {
    switch (selectedTimeRange.type) {
      case 'current-week':
        return `CW${currentCalendarWeek}`;
      case 'current-month':
        return format(currentDate, 'MMM yyyy');
      case 'current-year':
        return format(currentDate, 'yyyy');
      case 'custom':
        if (selectedTimeRange.startDate && selectedTimeRange.endDate) {
          const start = format(new Date(selectedTimeRange.startDate), 'MMM d');
          const end = format(new Date(selectedTimeRange.endDate), 'MMM d, yyyy');
          return `${start} - ${end}`;
        }
        return 'Custom Range';
      case 'all-time':
        return 'All Time';
      default:
        return 'Period';
    }
  }

  function previousPeriodClickHandler() {
    switch (selectedTimeRange.type) {
      case 'current-week':
        setCurrentDate(sub(currentDate, { weeks: 1 }));
        break;
      case 'current-month':
        setCurrentDate(sub(currentDate, { months: 1 }));
        break;
      case 'current-year':
        setCurrentDate(sub(currentDate, { years: 1 }));
        break;
      case 'custom':
        // For custom ranges, navigate by the same duration as the current range
        if (selectedTimeRange.startDate && selectedTimeRange.endDate) {
          const start = new Date(selectedTimeRange.startDate);
          const end = new Date(selectedTimeRange.endDate);
          const durationMs = end.getTime() - start.getTime();
          setCurrentDate(sub(currentDate, { days: durationMs / (1000 * 60 * 60 * 24) }));
        }
        break;
      // all-time doesn't have navigation
    }
  }

  function nextPeriodClickHandler() {
    switch (selectedTimeRange.type) {
      case 'current-week':
        setCurrentDate(add(currentDate, { weeks: 1 }));
        break;
      case 'current-month':
        setCurrentDate(add(currentDate, { months: 1 }));
        break;
      case 'current-year':
        setCurrentDate(add(currentDate, { years: 1 }));
        break;
      case 'custom':
        // For custom ranges, navigate by the same duration as the current range
        if (selectedTimeRange.startDate && selectedTimeRange.endDate) {
          const start = new Date(selectedTimeRange.startDate);
          const end = new Date(selectedTimeRange.endDate);
          const durationMs = end.getTime() - start.getTime();
          setCurrentDate(add(currentDate, { days: durationMs / (1000 * 60 * 60 * 24) }));
        }
        break;
      // all-time doesn't have navigation
    }
  }

  async function addTodo(
    title: string,
    context: string,
    dueDate: string,
    link: string,
    tags: string[],
  ) {
    // sanity check if due date is parsable
    const due = `${dueDate}T23:59:59.999Z`;
    try {
      format(new Date(due), 'yyyy-MM-dd');
    } catch (_e) {
      console.error('failed to parse due date', due);
      setError({
        name: 'ValidationError',
        message: 'Invalid date format. Please use YYYY-MM-DD format.',
        type: DatabaseErrorType.OPERATION_FAILED,
        retryable: false,
      } as DatabaseError);
      return;
    }

    const _id = new Date().toISOString();
    const todo: NewTodo = {
      _id,
      active: {},
      completed: null,
      context,
      description: '',
      due,
      link: link !== '' ? link : null,
      repeat: null,
      tags,
      title,
      version: 'alpha3',
    };

    setError(null);
    setIsSubmitting(true);

    try {
      await safeDb.safePut(todo);

      // Reset form on success
      setTodoTitle('');
      setTodoContext(CONTEXT_DEFAULT);
      setTodoLink('');
      setTodoTags([]);
      setTodoDue(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error('Failed to create todo:', err);
      setError(err as DatabaseError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function addTodoHandler(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (todoTitle !== '') {
      addTodo(todoTitle, todoContext, todoDue, todoLink, todoTags);
    }
  }

  return (
    <form onSubmit={addTodoHandler}>
      {error && <DatabaseErrorMessage error={error} onDismiss={() => setError(null)} />}
      <div className="block items-center justify-between border-b border-gray-200 bg-white py-4 sm:flex lg:mt-1.5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center divide-x divide-gray-100 dark:divide-gray-700">
          <div className="pr-3">
            <TextInput
              aria-label="Context"
              onChange={(e) => setTodoContext(e.target.value)}
              placeholder="context"
              type="text"
              value={todoContext}
            />
          </div>
          <div className="pr-3">
            <TextInput
              aria-label="New todo"
              onChange={(e) => setTodoTitle(e.target.value)}
              placeholder="todo"
              type="text"
              value={todoTitle}
            />
          </div>
          <div className="pr-3">
            <TextInput
              aria-label="Link"
              onChange={(e) => setTodoLink(e.target.value)}
              placeholder="url"
              type="text"
              value={todoLink}
            />
          </div>
          <div className="pr-3">
            <TagInput
              onChange={setTodoTags}
              placeholder="tags"
              suggestions={allTags}
              tags={todoTags}
            />
          </div>
          <div className="pr-3">
            <TextInput
              aria-label="Due date"
              onChange={(e) => setTodoDue(e.target.value)}
              placeholder="..."
              type="text"
              value={todoDue}
            />
          </div>
          <div className="pr-3">
            <Button color="blue" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Adding...' : 'Add todo'}
            </Button>
          </div>
        </div>
        <div className="hidden items-center space-y-3 space-x-0 sm:flex sm:space-y-0 sm:space-x-3">
          <TimeRangeFilter
            onTimeRangeChange={setSelectedTimeRange}
            selectedTimeRange={selectedTimeRange}
          />
          <StatusFilter onStatusChange={setSelectedStatus} selectedStatus={selectedStatus} />
          <EddoContextFilter
            availableContexts={allContexts}
            onContextsChange={setSelectedContexts}
            selectedContexts={selectedContexts}
          />
          <TagFilter
            availableTags={allTags}
            onTagsChange={setSelectedTags}
            selectedTags={selectedTags}
          />
          {selectedTimeRange.type !== 'all-time' && (
            <>
              <Button className="p-0" color="gray" onClick={previousPeriodClickHandler} size="xs">
                <RiArrowLeftSLine size="2em" />
              </Button>{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {getPeriodLabel()}
              </span>{' '}
              <Button className="p-0" color="gray" onClick={nextPeriodClickHandler} size="xs">
                <RiArrowRightSLine size="2em" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="flex space-x-4"></div>
    </form>
  );
};
