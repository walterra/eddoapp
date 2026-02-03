/**
 * Row action menu for TodoTable
 */
import { type Todo } from '@eddo/core-client';
import { type CSSProperties, type FC, useState } from 'react';
import { createPortal } from 'react-dom';
import { BiDotsVerticalRounded } from 'react-icons/bi';
import { DROPDOWN_CONTAINER, DROPDOWN_ITEM, ICON_BUTTON } from '../styles/interactive';
import { AddTodoPopover } from './add_todo_popover';
import { useRowActionsMenuState } from './todo_table_row_actions_helpers';

interface RowActionsMenuProps {
  todo: Todo;
  onOpenEdit: () => void;
  onToggleTimeTracking: () => void;
  onDelete: () => void;
  timeTrackingLabel: string;
}

interface DeleteConfirmDialogProps {
  todoTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteConfirmDialog: FC<DeleteConfirmDialogProps> = ({ todoTitle, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="mx-4 w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Delete todo</h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Delete <span className="font-medium text-neutral-900 dark:text-white">{todoTitle}</span>?
      </p>
      <div className="mt-4 flex justify-end gap-3">
        <button
          className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          onClick={onConfirm}
          type="button"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

interface RowActionsMenuButtonProps {
  onToggleMenu: () => void;
  setReference: (node: HTMLButtonElement | null) => void;
}

const RowActionsMenuButton: FC<RowActionsMenuButtonProps> = ({ onToggleMenu, setReference }) => (
  <button
    aria-label="Row actions"
    className={ICON_BUTTON}
    onClick={onToggleMenu}
    ref={setReference}
    title="Row actions"
    type="button"
  >
    <BiDotsVerticalRounded size="1.1em" />
  </button>
);

interface RowActionsMenuContentProps {
  onOpenEdit: () => void;
  onToggleTimeTracking: () => void;
  onCreateSubtask: () => void;
  onDelete: () => void;
  timeTrackingLabel: string;
  copied: boolean;
  onCopyId: () => void;
  setRefs: (node: HTMLDivElement | null) => void;
  floatingStyles: CSSProperties;
}

const RowActionsMenuContent: FC<RowActionsMenuContentProps> = ({
  onOpenEdit,
  onToggleTimeTracking,
  onCreateSubtask,
  onDelete,
  timeTrackingLabel,
  copied,
  onCopyId,
  setRefs,
  floatingStyles,
}) => (
  <div className={`${DROPDOWN_CONTAINER} min-w-40 p-1`} ref={setRefs} style={floatingStyles}>
    <button className={DROPDOWN_ITEM} onClick={onOpenEdit} type="button">
      Edit todo
    </button>
    <button className={DROPDOWN_ITEM} onClick={onToggleTimeTracking} type="button">
      {timeTrackingLabel}
    </button>
    <button className={DROPDOWN_ITEM} onClick={onCreateSubtask} type="button">
      Create subtask
    </button>
    <button className={DROPDOWN_ITEM} onClick={onCopyId} type="button">
      {copied ? 'Copied ID' : 'Copy ID'}
    </button>
    <button
      className={`${DROPDOWN_ITEM} text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300`}
      onClick={onDelete}
      type="button"
    >
      Delete todo
    </button>
  </div>
);

type RowActionsMenuState = ReturnType<typeof useRowActionsMenuState>;

interface RowActionsMenuOverlayProps {
  todo: Todo;
  menuState: RowActionsMenuState;
  showSubtaskPopover: boolean;
  showDeleteConfirm: boolean;
  onShowSubtaskPopover: (value: boolean) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onDeleteRequest: () => void;
  timeTrackingLabel: string;
}

const RowActionsMenuOverlay: FC<RowActionsMenuOverlayProps> = ({
  todo,
  menuState,
  showSubtaskPopover,
  showDeleteConfirm,
  onShowSubtaskPopover,
  onCancelDelete,
  onConfirmDelete,
  onDeleteRequest,
  timeTrackingLabel,
}) => (
  <>
    {showSubtaskPopover && (
      <AddTodoPopover
        enableKeyboardShortcut={false}
        hideTrigger={true}
        onOpenChange={onShowSubtaskPopover}
        open={showSubtaskPopover}
        parentTodo={todo}
        referenceElement={menuState.menuButtonRef.current}
      />
    )}
    {showDeleteConfirm && (
      <DeleteConfirmDialog
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
        todoTitle={todo.title}
      />
    )}
    {menuState.isOpen &&
      createPortal(
        <RowActionsMenuContent
          copied={menuState.copied}
          floatingStyles={menuState.floatingStyles}
          onCopyId={menuState.handleCopyId}
          onCreateSubtask={() => {
            onShowSubtaskPopover(true);
            menuState.toggleMenu();
          }}
          onDelete={onDeleteRequest}
          onOpenEdit={menuState.handleOpenEdit}
          onToggleTimeTracking={menuState.handleToggleTimeTracking}
          setRefs={menuState.setRefs}
          timeTrackingLabel={timeTrackingLabel}
        />,
        document.body,
      )}
  </>
);

export const RowActionsMenu: FC<RowActionsMenuProps> = ({
  todo,
  onOpenEdit,
  onToggleTimeTracking,
  onDelete,
  timeTrackingLabel,
}) => {
  const menuState = useRowActionsMenuState(todo._id, onToggleTimeTracking, onOpenEdit);
  const [showSubtaskPopover, setShowSubtaskPopover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    menuState.toggleMenu();
  };

  const handleCancelDelete = () => setShowDeleteConfirm(false);

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  return (
    <>
      <RowActionsMenuButton
        onToggleMenu={menuState.toggleMenu}
        setReference={menuState.setReference}
      />
      <RowActionsMenuOverlay
        menuState={menuState}
        onCancelDelete={handleCancelDelete}
        onConfirmDelete={handleConfirmDelete}
        onDeleteRequest={handleDelete}
        onShowSubtaskPopover={setShowSubtaskPopover}
        showDeleteConfirm={showDeleteConfirm}
        showSubtaskPopover={showSubtaskPopover}
        timeTrackingLabel={timeTrackingLabel}
        todo={todo}
      />
    </>
  );
};
