/**
 * Row action buttons for TodoTable
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { type CSSProperties, type FC, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BiDotsVerticalRounded, BiLinkExternal } from 'react-icons/bi';
import { useActiveTimer } from '../hooks/use_active_timer';
import {
  useAuditedToggleCompletionMutation,
  useAuditedToggleTimeTrackingMutation,
} from '../hooks/use_audited_todo_mutations';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { DROPDOWN_CONTAINER, DROPDOWN_ITEM, ICON_BUTTON } from '../styles/interactive';
import { AddTodoPopover } from './add_todo_popover';
import { useRowActionsMenuState } from './todo_table_row_actions_helpers';

interface RowActionsMenuProps {
  todo: Todo;
  onOpenEdit: () => void;
  onToggleTimeTracking: () => void;
  timeTrackingLabel: string;
}

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
  </div>
);

const RowActionsMenu: FC<RowActionsMenuProps> = ({
  todo,
  onOpenEdit,
  onToggleTimeTracking,
  timeTrackingLabel,
}) => {
  const menuState = useRowActionsMenuState(todo._id, onToggleTimeTracking, onOpenEdit);
  const [showSubtaskPopover, setShowSubtaskPopover] = useState(false);

  return (
    <>
      <RowActionsMenuButton
        onToggleMenu={menuState.toggleMenu}
        setReference={menuState.setReference}
      />
      {showSubtaskPopover && (
        <AddTodoPopover
          enableKeyboardShortcut={false}
          hideTrigger={true}
          onOpenChange={setShowSubtaskPopover}
          open={showSubtaskPopover}
          parentTodo={todo}
          referenceElement={menuState.menuButtonRef.current}
        />
      )}
      {menuState.isOpen &&
        createPortal(
          <RowActionsMenuContent
            copied={menuState.copied}
            floatingStyles={menuState.floatingStyles}
            onCopyId={menuState.handleCopyId}
            onCreateSubtask={() => {
              setShowSubtaskPopover(true);
              menuState.toggleMenu();
            }}
            onOpenEdit={menuState.handleOpenEdit}
            onToggleTimeTracking={menuState.handleToggleTimeTracking}
            setRefs={menuState.setRefs}
            timeTrackingLabel={timeTrackingLabel}
          />,
          document.body,
        )}
    </>
  );
};

/** Hook for managing row state (completion, time tracking) */
export const useRowState = (todo: Todo, todoDuration: number) => {
  const toggleCompletion = useAuditedToggleCompletionMutation();
  const toggleTimeTracking = useAuditedToggleTimeTrackingMutation();
  const [error, setError] = useState<DatabaseError | null>(null);

  const isUpdating = toggleCompletion.isPending || toggleTimeTracking.isPending;
  const thisButtonActive = Object.values(todo.active).some((d) => d === null);
  const { counter: activeCounter } = useActiveTimer(thisButtonActive);

  const activeDuration = useMemo(() => {
    void activeCounter;
    return todoDuration;
  }, [todoDuration, activeCounter]);

  const handleToggleCheckbox = useCallback(async () => {
    if (isUpdating) return;
    setError(null);
    try {
      await toggleCompletion.mutateAsync(todo);
    } catch (err) {
      setError(err as DatabaseError);
    }
  }, [isUpdating, todo, toggleCompletion]);

  const handleToggleTimeTracking = useCallback(async () => {
    if (isUpdating) return;
    setError(null);
    try {
      await toggleTimeTracking.mutateAsync(todo);
    } catch (err) {
      setError(err as DatabaseError);
    }
  }, [isUpdating, todo, toggleTimeTracking]);

  return {
    error,
    isUpdating,
    thisButtonActive,
    activeDuration,
    handleToggleCheckbox,
    handleToggleTimeTracking,
  };
};

export interface RowActionsProps {
  todo: Todo;
  todoDuration: number;
  timeTrackingActive: boolean;
}

/** Row action buttons (time tracking, details) */
export const RowActions: FC<RowActionsProps> = ({
  todo,
  todoDuration,
  timeTrackingActive: _timeTrackingActive,
}) => {
  const state = useRowState(todo, todoDuration);
  const { openTodoInEdit } = useTodoFlyoutContext();

  return (
    <td className="w-28 px-2 py-1">
      <div className="flex items-center justify-end gap-0.5">
        {todo.link ? (
          <a
            aria-label="Open link"
            className={ICON_BUTTON}
            href={todo.link}
            rel="noreferrer"
            target="_blank"
            title="Open link"
          >
            <BiLinkExternal size="1.1em" />
          </a>
        ) : (
          <span aria-hidden="true" className={`${ICON_BUTTON} opacity-0`}>
            <BiLinkExternal size="1.1em" />
          </span>
        )}
        <RowActionsMenu
          onOpenEdit={() => openTodoInEdit(todo)}
          onToggleTimeTracking={state.handleToggleTimeTracking}
          timeTrackingLabel={state.thisButtonActive ? 'Stop time tracking' : 'Start time tracking'}
          todo={todo}
        />
      </div>
    </td>
  );
};
