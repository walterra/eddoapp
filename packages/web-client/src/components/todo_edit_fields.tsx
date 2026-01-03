/**
 * Form field components for todo editing
 */
import { type Todo, getActiveDuration, getFormattedDuration } from '@eddo/core-client';
import { Button, Checkbox, Label, Textarea, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { TagInput } from './tag_input';

interface TodoFieldProps {
  todo: Todo;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

export const ContextField: FC<TodoFieldProps> = ({ todo, onChange }) => (
  <div>
    <div className="mb-2 block">
      <Label htmlFor="eddoTodoContext">Context</Label>
    </div>
    <TextInput
      aria-label="Context"
      id="eddoTodoContext"
      onChange={(e) => onChange((t) => ({ ...t, context: e.target.value }))}
      placeholder="context"
      type="text"
      value={todo.context}
    />
  </div>
);

export const TitleField: FC<TodoFieldProps> = ({ todo, onChange }) => (
  <div>
    <div className="mb-2 block">
      <Label htmlFor="eddoTodoTitle">Todo</Label>
    </div>
    <TextInput
      aria-label="Todo"
      id="eddoTodoTitle"
      onChange={(e) => onChange((t) => ({ ...t, title: e.target.value }))}
      placeholder="todo"
      type="text"
      value={todo.title}
    />
  </div>
);

export const DescriptionField: FC<TodoFieldProps> = ({ todo, onChange }) => {
  const [isPreview, setIsPreview] = useState(false);
  const hasContent = todo.description.trim().length > 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label htmlFor="eddoTodoDescription">Description</Label>
        {hasContent && (
          <div className="flex gap-1">
            <Button
              color={isPreview ? 'gray' : 'blue'}
              onClick={() => setIsPreview(false)}
              size="xs"
            >
              Edit
            </Button>
            <Button
              color={isPreview ? 'blue' : 'gray'}
              onClick={() => setIsPreview(true)}
              size="xs"
            >
              Preview
            </Button>
          </div>
        )}
      </div>
      {isPreview ? (
        <div
          aria-label="Description preview"
          className="prose prose-sm dark:prose-invert prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 max-w-none rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-700"
        >
          <Markdown remarkPlugins={[remarkGfm]}>{todo.description}</Markdown>
        </div>
      ) : (
        <Textarea
          aria-label="Description"
          id="eddoTodoDescription"
          onChange={(e) => onChange((t) => ({ ...t, description: e.target.value }))}
          placeholder="Add a description... (supports Markdown)"
          rows={6}
          value={todo.description}
        />
      )}
    </div>
  );
};

export const LinkField: FC<TodoFieldProps> = ({ todo, onChange }) => (
  <div>
    <div className="mb-2 block">
      <Label htmlFor="eddoTodoLink">Link</Label>
    </div>
    <TextInput
      aria-label="Link"
      id="eddoTodoLink"
      onChange={(e) =>
        onChange((t) => ({ ...t, link: e.target.value !== '' ? e.target.value : null }))
      }
      placeholder="url"
      type="text"
      value={todo.link ?? ''}
    />
  </div>
);

export const ExternalIdField: FC<TodoFieldProps> = ({ todo, onChange }) => (
  <div>
    <div className="mb-2 block">
      <Label htmlFor="eddoTodoExternalId">External ID</Label>
    </div>
    <TextInput
      aria-label="External ID"
      id="eddoTodoExternalId"
      onChange={(e) =>
        onChange((t) => ({ ...t, externalId: e.target.value !== '' ? e.target.value : null }))
      }
      placeholder="github:owner/repo/issues/123"
      type="text"
      value={todo.externalId ?? ''}
    />
  </div>
);

interface TagsFieldProps extends TodoFieldProps {
  allTags: string[];
}

export const TagsField: FC<TagsFieldProps> = ({ todo, onChange, allTags }) => (
  <div>
    <div className="mb-2 block">
      <Label htmlFor="eddoTodoTags">Tags</Label>
    </div>
    <TagInput
      onChange={(tags) => onChange((t) => ({ ...t, tags }))}
      placeholder="Add tags..."
      suggestions={allTags}
      tags={todo.tags}
    />
  </div>
);

export const DueDateField: FC<TodoFieldProps> = ({ todo, onChange }) => (
  <div>
    <div className="-mx-3 mb-2 flex flex-wrap items-end">
      <div className="mb-6 grow px-3 md:mb-0">
        <div className="mb-2 block">
          <Label htmlFor="eddoTodoDue">Due date</Label>
        </div>
        <TextInput
          aria-label="Due date"
          id="eddoTodoDue"
          onChange={(e) => onChange((t) => ({ ...t, due: e.target.value }))}
          placeholder="todo"
          type="text"
          value={todo.due}
        />
      </div>
      <div className="mb-6 flex-none px-3 md:mb-0">
        <Button
          color="gray"
          onClick={() =>
            onChange((t) => ({
              ...t,
              due: `${new Date().toISOString().split('T')[0]}T${t.due.split('T')[1]}`,
            }))
          }
        >
          Set to today
        </Button>
      </div>
    </div>
  </div>
);

export const RepeatField: FC<TodoFieldProps> = ({ todo, onChange }) => (
  <div>
    <div className="mb-2 block">
      <Label htmlFor="eddoTodoRepeat">Repeat in X days</Label>
    </div>
    <TextInput
      aria-label="Repeat"
      id="eddoTodoRepeat"
      onChange={(e) =>
        onChange((t) => ({
          ...t,
          repeat: e.target.value !== '' ? parseInt(e.target.value, 10) : null,
        }))
      }
      placeholder="days"
      type="text"
      value={todo.repeat ?? ''}
    />
  </div>
);

export const CompletedField: FC<TodoFieldProps> = ({ todo, onChange }) => (
  <div className="flex items-center gap-2">
    <Checkbox
      className="checkbox checkbox-xs text-neutral-400"
      color="gray"
      defaultChecked={todo.completed !== null}
      id="eddoTodoComplete"
      key={`edit-checkbox-${todo._id}-${todo.completed !== null}`}
      onChange={() =>
        onChange((t) => ({
          ...t,
          completed: t.completed === null ? new Date().toISOString() : null,
        }))
      }
    />
    <Label htmlFor="eddoTodoComplete">Completed</Label>
  </div>
);

interface TimeTrackingFieldProps extends TodoFieldProps {
  activeArray: Array<[string, string | null]>;
}

export const TimeTrackingField: FC<TimeTrackingFieldProps> = ({ activeArray, onChange }) => (
  <div>
    <div className="mb-2 block">
      <Label htmlFor="">Time tracking</Label>
    </div>
    {activeArray.map(([from, to], index) => (
      <TimeTrackingRow
        activeArray={activeArray}
        from={from}
        index={index}
        key={index}
        onChange={onChange}
        to={to}
      />
    ))}
  </div>
);

interface TimeTrackingRowProps {
  from: string;
  to: string | null;
  index: number;
  activeArray: Array<[string, string | null]>;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

function TimeTrackingRow({ from, to, index, activeArray, onChange }: TimeTrackingRowProps) {
  const updateFrom = (value: string) => {
    const updated = [...activeArray] as Array<[string, string | null]>;
    updated[index] = [value, to];
    onChange((t) => ({ ...t, active: Object.fromEntries(updated) }));
  };

  const updateTo = (value: string) => {
    const updated = [...activeArray] as Array<[string, string | null]>;
    updated[index] = [from, value];
    onChange((t) => ({ ...t, active: Object.fromEntries(updated) }));
  };

  return (
    <div className="-mx-3 mb-2 flex flex-wrap items-end">
      <div className="mb-6 grow px-3 md:mb-0">
        <TextInput
          aria-label="From"
          id={`eddoTodoFrom-${index}`}
          onChange={(e) => updateFrom(e.target.value)}
          placeholder="from"
          type="text"
          value={from ?? ''}
        />
      </div>
      <div className="mb-6 grow px-3 md:mb-0">
        <TextInput
          aria-label="To"
          id={`eddoTodoTo-${index}`}
          onChange={(e) => updateTo(e.target.value)}
          placeholder="to"
          type="text"
          value={to ?? ''}
        />
      </div>
      <div className="mb-6 grow px-3 md:mb-0">
        <DurationDisplay from={from} to={to} />
      </div>
    </div>
  );
}

function DurationDisplay({ from, to }: { from: string; to: string | null }) {
  try {
    const duration = getActiveDuration({ [from]: to });
    if (!Number.isFinite(duration) || duration < 0) {
      return <>n/a</>;
    }
    const formatted = getFormattedDuration(duration);
    return <>{formatted !== '' ? formatted : 'n/a'}</>;
  } catch (_e) {
    return <>n/a</>;
  }
}

/**
 * Validates time tracking entries
 */
export function validateTimeTracking(activeArray: Array<[string, string | null]>): boolean {
  return activeArray.every(([from, to]) => {
    try {
      const duration = getActiveDuration({ [from]: to });
      if (!Number.isFinite(duration) || duration < 0) {
        return false;
      }
      const formatted = getFormattedDuration(duration);
      return formatted !== '';
    } catch (_e) {
      return false;
    }
  });
}
