/**
 * Shared components and utilities for due date popovers
 */
import { format } from 'date-fns';
import { type FC, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { DROPDOWN_ITEM, TRANSITION_FAST } from '../styles/interactive';

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  getDate: () => Date;
}

export interface PopoverPosition {
  top: number;
  left: number;
}

/**
 * Format a date as ISO due date string (end of day)
 */
export const formatDueDate = (date: Date): string => {
  return `${format(date, 'yyyy-MM-dd')}T23:59:59.999Z`;
};

const POPOVER_MENU_STYLES =
  'fixed z-50 min-w-36 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

interface PopoverMenuProps {
  actions: readonly QuickAction[];
  position: PopoverPosition;
  onSelect: (date: Date) => void;
  onClose: () => void;
  header?: React.ReactNode;
}

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

const QuickActionButton: FC<{ action: QuickAction; onSelect: (date: Date) => void }> = ({
  action,
  onSelect,
}) => (
  <button
    className={`${DROPDOWN_ITEM} ${TRANSITION_FAST} flex items-center gap-2`}
    onClick={() => onSelect(action.getDate())}
    type="button"
  >
    {action.icon}
    <span>{action.label}</span>
    <span className="ml-auto text-xs text-neutral-400">{format(action.getDate(), 'MMM d')}</span>
  </button>
);

/**
 * Reusable popover menu for date quick actions
 */
export const PopoverMenu: FC<PopoverMenuProps> = ({
  actions,
  position,
  onSelect,
  onClose,
  header,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  usePopoverDismiss(menuRef, onClose);

  return createPortal(
    <div
      className={POPOVER_MENU_STYLES}
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
    >
      {header}
      {actions.map((action) => (
        <QuickActionButton action={action} key={action.label} onSelect={onSelect} />
      ))}
    </div>,
    document.body,
  );
};
