/**
 * Read-only view components for todo display
 */
import {
  type Todo,
  type TodoNote,
  getActiveDuration,
  getFormattedDuration,
} from '@eddo/core-client';
import { type FC, useState } from 'react';
import { BiCheckCircle, BiCircle, BiNote, BiSubdirectoryRight } from 'react-icons/bi';

import { useChildTodos, useParentTodo } from '../hooks/use_parent_child';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { TEXT_LINK } from '../styles/interactive';
import { AttachmentMarkdown, MARKDOWN_PROSE_CLASSES } from './attachment_markdown';
import { CopyIdButton } from './copy_id_button';
import { ImageLightbox } from './image_lightbox';
import { NoteViewItem } from './note_view_item';
import { TagDisplay } from './tag_display';
import { BlockedByView } from './todo_blocked_by_view';
import { MetadataView } from './todo_metadata_view';

interface TodoViewFieldsProps {
  todo: Todo;
}

/** Markdown prose styles - use MARKDOWN_PROSE_CLASSES from attachment_markdown */

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

/** Formats created date as short string */
const formatCreatedDate = (id: string): string => {
  const date = new Date(id);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const TitleView: FC<{ todo: Todo }> = ({ todo }) => (
  <div>
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{todo.title}</h2>
    <div className="mt-2 flex items-center gap-3">
      <StatusBadge completed={todo.completed} />
      <span className="text-sm text-neutral-500 dark:text-neutral-400">{todo.context}</span>
      <span className="text-neutral-300 dark:text-neutral-600">•</span>
      <span className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
        {formatCreatedDate(todo._id)}
        <CopyIdButton size="sm" todoId={todo._id} />
      </span>
    </div>
  </div>
);

const DescriptionView: FC<{ description: string; todoId: string }> = ({ description, todoId }) => {
  const [lightboxDocId, setLightboxDocId] = useState<string | null>(null);

  if (!description.trim()) {
    return <FieldRow label="Description">{EMPTY_VALUE}</FieldRow>;
  }

  return (
    <div>
      <div className={LABEL_CLASS}>Description</div>
      <div
        className={`${MARKDOWN_PROSE_CLASSES} mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-600 dark:bg-neutral-900/50`}
      >
        <AttachmentMarkdown onImageClick={setLightboxDocId} todoId={todoId}>
          {description}
        </AttachmentMarkdown>
      </div>
      <ImageLightbox
        docId={lightboxDocId ?? ''}
        onClose={() => setLightboxDocId(null)}
        show={!!lightboxDocId}
      />
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

const ParentView: FC<{ parentId: string | null | undefined }> = ({ parentId }) => {
  const { data: parentTodo, isLoading } = useParentTodo(parentId);
  const { openTodo } = useTodoFlyoutContext();

  if (!parentId) {
    return null;
  }

  return (
    <div>
      <div className={LABEL_CLASS}>Parent Todo</div>
      <button
        className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900/50 dark:hover:bg-neutral-800"
        disabled={!parentTodo}
        onClick={() => parentTodo && openTodo(parentTodo)}
        type="button"
      >
        <BiSubdirectoryRight
          className="rotate-180 text-neutral-400 dark:text-neutral-500"
          size="1.2em"
        />
        {isLoading ? (
          <span className="text-sm text-neutral-500">Loading...</span>
        ) : parentTodo ? (
          <span className="text-sm text-neutral-900 dark:text-white">{parentTodo.title}</span>
        ) : (
          <span className="text-sm text-amber-600 dark:text-amber-400">Parent not found</span>
        )}
      </button>
    </div>
  );
};

interface NotesViewProps {
  todoId: string;
  notes: TodoNote[] | undefined;
}

const NotesView: FC<NotesViewProps> = ({ todoId, notes }) => {
  if (!notes || notes.length === 0) {
    return null;
  }

  // Sort notes by createdAt ascending (oldest first - chronological order)
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div>
      <div className={`${LABEL_CLASS} flex items-center gap-1.5`}>
        <BiNote size="1.1em" />
        Notes ({notes.length})
      </div>
      <div className="mt-2 space-y-2">
        {sortedNotes.map((note) => (
          <NoteViewItem key={note.id} note={note} todoId={todoId} />
        ))}
      </div>
    </div>
  );
};

const SubtasksView: FC<{ todoId: string }> = ({ todoId }) => {
  const { data: children, isLoading } = useChildTodos(todoId);
  const { openTodo } = useTodoFlyoutContext();

  if (isLoading) {
    return (
      <div>
        <div className={LABEL_CLASS}>Subtasks</div>
        <div className="mt-2 text-sm text-neutral-500">Loading...</div>
      </div>
    );
  }

  if (!children || children.length === 0) {
    return null;
  }

  const completedCount = children.filter((c) => c.completed !== null).length;

  return (
    <div>
      <div className={LABEL_CLASS}>
        Subtasks ({completedCount}/{children.length})
      </div>
      <div className="mt-2 space-y-1">
        {children.map((child) => (
          <button
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900/50 dark:hover:bg-neutral-800"
            key={child._id}
            onClick={() => openTodo(child)}
            type="button"
          >
            {child.completed ? (
              <BiCheckCircle className="text-green-500" size="1.2em" />
            ) : (
              <BiCircle className="text-neutral-400 dark:text-neutral-500" size="1.2em" />
            )}
            <span
              className={`text-sm ${child.completed ? 'text-neutral-500 line-through' : 'text-neutral-900 dark:text-white'}`}
            >
              {child.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const TodoViewFields: FC<TodoViewFieldsProps> = ({ todo }) => (
  <div className="flex flex-col gap-6">
    <TitleView todo={todo} />
    <ParentView parentId={todo.parentId} />
    <BlockedByView blockedBy={todo.blockedBy} />
    <DescriptionView description={todo.description} todoId={todo._id} />

    <div className="grid grid-cols-2 gap-4">
      <DueDateView due={todo.due} />
      <RepeatView repeat={todo.repeat} />
    </div>

    <TagsView tags={todo.tags} />
    <SubtasksView todoId={todo._id} />
    <NotesView notes={todo.notes} todoId={todo._id} />
    <LinkView link={todo.link} />
    <ExternalIdView externalId={todo.externalId ?? null} />
    <MetadataView metadata={todo.metadata} />
    <TimeTrackingView active={todo.active} />

    <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
      <CompletedView completed={todo.completed} />
    </div>
  </div>
);
