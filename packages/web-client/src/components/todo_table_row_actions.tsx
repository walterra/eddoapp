/**
 * Row action buttons for TodoTable
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import {
  type CSSProperties,
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { BiDotsVerticalRounded, BiLinkExternal } from 'react-icons/bi';

import { AddTodoPopover } from './add_todo_popover';

import { useActiveTimer } from '../hooks/use_active_timer';
import {
  useAuditedToggleCompletionMutation,
  useAuditedToggleTimeTrackingMutation,
} from '../hooks/use_audited_todo_mutations';
import { useFloatingPosition } from '../hooks/use_floating_position';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { DROPDOWN_CONTAINER, DROPDOWN_ITEM, ICON_BUTTON } from '../styles/interactive';

/** Hook for popover dismiss behavior (click outside, escape key) */
const usePopoverDismiss = (
  menuRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuRef, onClose]);
};

/** Copies text to clipboard with fallback for older browsers. */
const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy method
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};

interface RowActionsMenuProps {
  todo: Todo;
  onOpenDetails: () => void;
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
  todo: Todo;
  onOpenDetails: () => void;
  onToggleTimeTracking: () => void;
  timeTrackingLabel: string;
  copied: boolean;
  onCopyId: () => void;
  setRefs: (node: HTMLDivElement | null) => void;
  floatingStyles: CSSProperties;
}

const RowActionsMenuContent: FC<RowActionsMenuContentProps> = ({
  todo,
  onOpenDetails,
  onToggleTimeTracking,
  timeTrackingLabel,
  copied,
  onCopyId,
  setRefs,
  floatingStyles,
}) => (
  <div className={`${DROPDOWN_CONTAINER} min-w-40 p-1`} ref={setRefs} style={floatingStyles}>
    <button className={DROPDOWN_ITEM} onClick={onOpenDetails} type="button">
      Open details
    </button>
    <button className={DROPDOWN_ITEM} onClick={onToggleTimeTracking} type="button">
      {timeTrackingLabel}
    </button>
    <AddTodoPopover
      enableKeyboardShortcut={false}
      parentTodo={todo}
      triggerClassName={DROPDOWN_ITEM}
      triggerLabel="Create subtask"
      triggerTitle="Create subtask"
      triggerVariant="text"
    />
    <button className={DROPDOWN_ITEM} onClick={onCopyId} type="button">
      {copied ? 'Copied ID' : 'Copy ID'}
    </button>
  </div>
);

interface RowActionsMenuState {
  copied: boolean;
  floatingStyles: CSSProperties;
  handleCopyId: () => void;
  handleToggleTimeTracking: () => void;
  isOpen: boolean;
  setReference: (node: HTMLButtonElement | null) => void;
  setRefs: (node: HTMLDivElement | null) => void;
  toggleMenu: () => void;
}

const useRowActionsMenuState = (
  todoId: string,
  onToggleTimeTracking: () => void,
): RowActionsMenuState => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { refs, floatingStyles } = useFloatingPosition({
    placement: 'bottom-end',
    open: isOpen,
  });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      menuRef.current = node;
      refs.setFloating(node);
    },
    [refs],
  );

  const closeMenu = useCallback(() => setIsOpen(false), []);
  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleCopyId = useCallback(async () => {
    const success = await copyToClipboard(todoId);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    closeMenu();
  }, [closeMenu, todoId]);

  const handleToggleTimeTracking = useCallback(() => {
    onToggleTimeTracking();
    closeMenu();
  }, [closeMenu, onToggleTimeTracking]);

  usePopoverDismiss(menuRef, closeMenu);

  return {
    copied,
    floatingStyles: floatingStyles as CSSProperties,
    handleCopyId,
    handleToggleTimeTracking,
    isOpen,
    setReference: refs.setReference,
    setRefs,
    toggleMenu,
  };
};

const RowActionsMenu: FC<RowActionsMenuProps> = ({
  todo,
  onOpenDetails,
  onToggleTimeTracking,
  timeTrackingLabel,
}) => {
  const menuState = useRowActionsMenuState(todo._id, onToggleTimeTracking);

  return (
    <>
      <RowActionsMenuButton
        onToggleMenu={menuState.toggleMenu}
        setReference={menuState.setReference}
      />
      {menuState.isOpen &&
        createPortal(
          <RowActionsMenuContent
            copied={menuState.copied}
            floatingStyles={menuState.floatingStyles}
            onCopyId={menuState.handleCopyId}
            onOpenDetails={onOpenDetails}
            onToggleTimeTracking={menuState.handleToggleTimeTracking}
            setRefs={menuState.setRefs}
            timeTrackingLabel={timeTrackingLabel}
            todo={todo}
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
  const { openTodo } = useTodoFlyoutContext();

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
          onOpenDetails={() => openTodo(todo)}
          onToggleTimeTracking={state.handleToggleTimeTracking}
          timeTrackingLabel={state.thisButtonActive ? 'Stop time tracking' : 'Start time tracking'}
          todo={todo}
        />
      </div>
    </td>
  );
};
