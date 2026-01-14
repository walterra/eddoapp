/**
 * Flyout panel for viewing and editing todo items
 */
import { type Todo } from '@eddo/core-client';
import { Button, Drawer, DrawerHeader, DrawerItems } from 'flowbite-react';
import { type FC } from 'react';
import { createPortal } from 'react-dom';
import { BiEdit, BiShow } from 'react-icons/bi';

import { useTags } from '../hooks/use_tags';
import { useTodoFlyoutState } from '../hooks/use_todo_flyout_state';
import { BTN_GHOST, BTN_PRIMARY, TRANSITION } from '../styles/interactive';
import { BlockedByField } from './todo_blocked_by_field';
import { ErrorDisplay } from './todo_edit_error';
import {
  CompletedField,
  ContextField,
  DescriptionField,
  DueDateField,
  ExternalIdField,
  LinkField,
  RepeatField,
  TagsField,
  TimeTrackingField,
  TitleField,
  validateTimeTracking,
} from './todo_edit_fields';
import { MetadataField } from './todo_metadata_field';
import { NotesField } from './todo_notes_field';
import { ParentIdField } from './todo_parent_field';
import { TodoViewFields } from './todo_view_fields';

type FlyoutMode = 'view' | 'edit';

interface TodoFlyoutProps {
  onClose: () => void;
  show: boolean;
  todo: Todo;
}

interface UnsavedChangesDialogProps {
  onDiscard: () => void;
  onKeepEditing: () => void;
}

const UnsavedChangesDialog: FC<UnsavedChangesDialogProps> = ({ onDiscard, onKeepEditing }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="mx-4 max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Unsaved Changes</h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        You have unsaved changes. Do you want to discard them?
      </p>
      <div className="mt-4 flex justify-end gap-3">
        <button className={BTN_GHOST} onClick={onKeepEditing} type="button">
          Keep Editing
        </button>
        <button
          className={`${BTN_PRIMARY} bg-red-600 hover:bg-red-700`}
          onClick={onDiscard}
          type="button"
        >
          Discard
        </button>
      </div>
    </div>
  </div>
);

interface ModeToggleProps {
  mode: FlyoutMode;
  onToggle: () => void;
}

const ModeToggle: FC<ModeToggleProps> = ({ mode, onToggle }) => (
  <button
    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${TRANSITION} ${
      mode === 'view'
        ? 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    }`}
    onClick={onToggle}
    title={mode === 'view' ? 'Switch to edit mode' : 'Switch to view mode'}
    type="button"
  >
    {mode === 'view' ? (
      <>
        <BiEdit size="1.1em" />
        Edit
      </>
    ) : (
      <>
        <BiShow size="1.1em" />
        View
      </>
    )}
  </button>
);

interface EditFormFieldsProps {
  todo: Todo;
  allTags: string[];
  activeArray: Array<[string, string | null]>;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

const EditFormFields: FC<EditFormFieldsProps> = ({ todo, allTags, activeArray, onChange }) => (
  <div className="flex flex-col gap-6">
    <TitleField onChange={onChange} todo={todo} />
    <DescriptionField onChange={onChange} todo={todo} />
    <ContextField onChange={onChange} todo={todo} />
    <TagsField allTags={allTags} onChange={onChange} todo={todo} />
    <DueDateField onChange={onChange} todo={todo} />
    <LinkField onChange={onChange} todo={todo} />
    <ExternalIdField onChange={onChange} todo={todo} />
    <ParentIdField onChange={onChange} todo={todo} />
    <BlockedByField onChange={onChange} todo={todo} />
    <RepeatField onChange={onChange} todo={todo} />
    <MetadataField onChange={onChange} todo={todo} />
    <NotesField onChange={onChange} todo={todo} />
    <CompletedField onChange={onChange} todo={todo} />
    <TimeTrackingField activeArray={activeArray} onChange={onChange} todo={todo} />
  </div>
);

interface ViewModeActionsProps {
  onDelete: (e: React.FormEvent<HTMLButtonElement>) => void;
  isDeleting: boolean;
}

const ViewModeActions: FC<ViewModeActionsProps> = ({ onDelete, isDeleting }) => (
  <div className="-mx-4 -mb-4 flex w-[calc(100%+2rem)] justify-end border-t border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-700 dark:bg-neutral-900">
    <Button color="red" disabled={isDeleting} onClick={onDelete}>
      {isDeleting ? 'Deleting...' : 'Delete'}
    </Button>
  </div>
);

interface EditModeActionsProps {
  onSave: (e: React.FormEvent<HTMLButtonElement>) => void;
  onCancel: () => void;
  isActiveValid: boolean;
  isSaving: boolean;
}

const EditModeActions: FC<EditModeActionsProps> = ({
  onSave,
  onCancel,
  isActiveValid,
  isSaving,
}) => (
  <div className="-mx-4 -mb-4 flex w-[calc(100%+2rem)] justify-between border-t border-neutral-200 bg-neutral-50 px-4 py-4 dark:border-neutral-700 dark:bg-neutral-900">
    <Button color="gray" disabled={isSaving} onClick={onCancel}>
      Cancel
    </Button>
    <Button color="blue" disabled={!isActiveValid || isSaving} onClick={onSave}>
      {isSaving ? 'Saving...' : 'Save'}
    </Button>
  </div>
);

interface FlyoutContentProps {
  state: ReturnType<typeof useTodoFlyoutState>;
  allTags: string[];
  activeArray: Array<[string, string | null]>;
}

const FlyoutContent: FC<FlyoutContentProps> = ({ state, allTags, activeArray }) => {
  // Use editedTodo for both view and edit modes to ensure consistency after save.
  // The editedTodo is synced from todo prop when flyout opens or todo changes.
  const displayTodo = state.editedTodo;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {state.error && <ErrorDisplay error={state.error} onClear={state.clearError} />}
        {state.mode === 'view' ? (
          <TodoViewFields todo={displayTodo} />
        ) : (
          <EditFormFields
            activeArray={activeArray}
            allTags={allTags}
            onChange={state.setEditedTodo}
            todo={displayTodo}
          />
        )}
      </div>
      {state.mode === 'view' ? (
        <ViewModeActions isDeleting={state.isDeleting} onDelete={state.handleDelete} />
      ) : (
        <EditModeActions
          isActiveValid={validateTimeTracking(activeArray)}
          isSaving={state.isSaving}
          onCancel={state.handleCancelEdit}
          onSave={state.handleSave}
        />
      )}
    </div>
  );
};

/** Custom theme for Flowbite Drawer to use neutral palette instead of gray */
const drawerTheme = {
  root: {
    base: 'fixed z-40 overflow-y-auto bg-white p-4 transition-transform dark:bg-neutral-800',
    backdrop: 'fixed inset-0 z-30 bg-neutral-900/50',
    position: {
      right: {
        on: 'right-0 top-0 h-screen w-80 transform-none shadow-xl dark:shadow-neutral-900/50',
        off: 'right-0 top-0 h-screen w-80 translate-x-full',
      },
    },
  },
  header: {
    inner: {
      titleText:
        'mb-4 inline-flex items-center text-base font-semibold text-neutral-500 dark:text-neutral-400',
      closeButton:
        'absolute end-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-sm text-neutral-400 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-white',
      closeIcon: 'h-4 w-4',
    },
  },
};

/** Inner component that uses hooks - only rendered when flyout is open */
const TodoFlyoutInner: FC<TodoFlyoutProps> = ({ onClose, show, todo }) => {
  const { allTags } = useTags();
  const state = useTodoFlyoutState(todo, show, onClose);
  const activeArray = Object.entries(state.editedTodo.active);

  return createPortal(
    <>
      <Drawer
        className="!w-[640px]"
        data-testid="todo-flyout"
        onClose={state.handleClose}
        open={show}
        position="right"
        theme={drawerTheme}
      >
        <DrawerHeader
          title={state.mode === 'view' ? 'Todo Details' : 'Edit Todo'}
          titleIcon={() => (
            <div className="mr-2">
              <ModeToggle mode={state.mode} onToggle={state.handleModeToggle} />
            </div>
          )}
        />
        <DrawerItems>
          <FlyoutContent activeArray={activeArray} allTags={allTags} state={state} />
        </DrawerItems>
      </Drawer>
      {state.showUnsavedDialog && (
        <UnsavedChangesDialog
          onDiscard={state.handleDiscardChanges}
          onKeepEditing={state.handleKeepEditing}
        />
      )}
    </>,
    document.body,
  );
};

/**
 * Flyout panel for viewing and editing todo items.
 * Only mounts hooks when actually shown to avoid creating mutations for every row.
 */
export const TodoFlyout: FC<TodoFlyoutProps> = ({ onClose, show, todo }) => {
  if (!show) {
    return null;
  }

  return <TodoFlyoutInner onClose={onClose} show={show} todo={todo} />;
};
