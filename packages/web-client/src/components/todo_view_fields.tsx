/**
 * Read-only view components for todo display
 */
import { type Todo, getActiveDuration, getFormattedDuration } from '@eddo/core-client';
import { type FC } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { TEXT_LINK } from '../styles/interactive';
import { TagDisplay } from './tag_display';

interface TodoViewFieldsProps {
  todo: Todo;
}

/** Markdown prose styles for consistent rendering */
const MARKDOWN_PROSE =
  'prose prose-sm dark:prose-invert prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 max-w-none';

/** Label styling for field headers */
const LABEL_CLASS =
  'text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide';

/** Value styling for field content */
const VALUE_CLASS = 'text-sm text-neutral-900 dark:text-white';

/** Empty value placeholder */
const EMPTY_VALUE = <span className="text-neutral-400 italic dark:text-neutral-500">—</span>;

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
}

const FieldRow: FC<FieldRowProps> = ({ label, children }) => (
  <div>
    <div className={LABEL_CLASS}>{label}</div>
    <div className={`${VALUE_CLASS} mt-1`}>{children}</div>
  </div>
);

const StatusBadge: FC<{ completed: string | null }> = ({ completed }) => {
  if (completed) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
      Open
    </span>
  );
};

const TitleView: FC<{ todo: Todo }> = ({ todo }) => (
  <div>
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{todo.title}</h2>
    <div className="mt-2 flex items-center gap-3">
      <StatusBadge completed={todo.completed} />
      <span className="text-sm text-neutral-500 dark:text-neutral-400">{todo.context}</span>
    </div>
  </div>
);

const DescriptionView: FC<{ description: string }> = ({ description }) => {
  if (!description.trim()) {
    return <FieldRow label="Description">{EMPTY_VALUE}</FieldRow>;
  }

  return (
    <div>
      <div className={LABEL_CLASS}>Description</div>
      <div
        className={`${MARKDOWN_PROSE} mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-600 dark:bg-neutral-900/50`}
      >
        <Markdown remarkPlugins={[remarkGfm]}>{description}</Markdown>
      </div>
    </div>
  );
};

const TagsView: FC<{ tags: string[] }> = ({ tags }) => (
  <FieldRow label="Tags">{tags.length > 0 ? <TagDisplay tags={tags} /> : EMPTY_VALUE}</FieldRow>
);

const LinkView: FC<{ link: string | null }> = ({ link }) => (
  <FieldRow label="Link">
    {link ? (
      <a className={`${TEXT_LINK} break-all`} href={link} rel="noreferrer" target="_blank">
        {link}
      </a>
    ) : (
      EMPTY_VALUE
    )}
  </FieldRow>
);

const ExternalIdView: FC<{ externalId: string | null }> = ({ externalId }) => (
  <FieldRow label="External ID">
    {externalId ? <span className="font-mono text-xs">{externalId}</span> : EMPTY_VALUE}
  </FieldRow>
);

const DueDateView: FC<{ due: string }> = ({ due }) => {
  const dateOnly = due.split('T')[0];
  return <FieldRow label="Due Date">{dateOnly || EMPTY_VALUE}</FieldRow>;
};

const RepeatView: FC<{ repeat: number | null }> = ({ repeat }) => (
  <FieldRow label="Repeat">
    {repeat !== null ? `Every ${repeat} day${repeat !== 1 ? 's' : ''}` : EMPTY_VALUE}
  </FieldRow>
);

const CompletedView: FC<{ completed: string | null }> = ({ completed }) => (
  <FieldRow label="Completed">
    {completed ? new Date(completed).toLocaleString() : EMPTY_VALUE}
  </FieldRow>
);

const CreatedView: FC<{ id: string }> = ({ id }) => (
  <FieldRow label="Created">{new Date(id).toLocaleString()}</FieldRow>
);

interface TimeTrackingViewProps {
  active: Record<string, string | null>;
}

const TimeTrackingView: FC<TimeTrackingViewProps> = ({ active }) => {
  const entries = Object.entries(active);
  const totalDuration = getActiveDuration(active);
  const hasActiveSession = entries.some(([, to]) => to === null);

  if (entries.length === 0) {
    return <FieldRow label="Time Tracking">{EMPTY_VALUE}</FieldRow>;
  }

  return (
    <div>
      <div className={LABEL_CLASS}>Time Tracking</div>
      <div className="mt-2 space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-900/50">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Total</span>
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">
            {getFormattedDuration(totalDuration) || '0m'}
            {hasActiveSession && (
              <span className="ml-2 inline-flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
            )}
          </span>
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {entries.length} session{entries.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

export const TodoViewFields: FC<TodoViewFieldsProps> = ({ todo }) => (
  <div className="flex flex-col gap-6">
    <TitleView todo={todo} />
    <DescriptionView description={todo.description} />

    <div className="grid grid-cols-2 gap-4">
      <DueDateView due={todo.due} />
      <RepeatView repeat={todo.repeat} />
    </div>

    <TagsView tags={todo.tags} />
    <LinkView link={todo.link} />
    <ExternalIdView externalId={todo.externalId ?? null} />
    <TimeTrackingView active={todo.active} />

    <div className="grid grid-cols-2 gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
      <CompletedView completed={todo.completed} />
      <CreatedView id={todo._id} />
    </div>
  </div>
);
