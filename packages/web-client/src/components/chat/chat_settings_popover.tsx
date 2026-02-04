import { type CSSProperties, type FC, type RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineCog } from 'react-icons/hi';

import { useFloatingPosition } from '../../hooks/use_floating_position';
import { TRANSITION_FAST } from '../../styles/interactive';
import { ToggleSwitch } from '../toggle_switch';
import type { ReasoningPreferenceSetter } from './chat_reasoning_preference';

const POPOVER_STYLES =
  'z-50 min-w-56 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

const DEFAULT_BUTTON_CLASSNAME =
  'rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200';

/** Hook for popover dismiss behavior (click outside, escape key) */
const usePopoverDismiss = (
  menuRef: RefObject<HTMLDivElement | null>,
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

export interface ChatSettingsPopoverProps {
  showReasoning: boolean;
  onToggleReasoning: ReasoningPreferenceSetter;
  buttonClassName?: string;
}

export const ChatSettingsPopover: FC<ChatSettingsPopoverProps> = ({
  showReasoning,
  onToggleReasoning,
  buttonClassName = DEFAULT_BUTTON_CLASSNAME,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { refs, floatingStyles } = useFloatingPosition({ placement: 'bottom-end', open: isOpen });
  const menuRef = useRef<HTMLDivElement | null>(null);

  const setFloatingRef = (node: HTMLDivElement | null) => {
    menuRef.current = node;
    refs.setFloating(node);
  };

  usePopoverDismiss(menuRef, () => setIsOpen(false));

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Chat settings"
        className={buttonClassName}
        onClick={() => setIsOpen((prev) => !prev)}
        ref={refs.setReference}
        title="Chat settings"
        type="button"
      >
        <HiOutlineCog className="h-4 w-4" />
      </button>
      {isOpen &&
        createPortal(
          <div
            className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
            ref={setFloatingRef}
            style={floatingStyles as CSSProperties}
          >
            <div className="text-xs font-medium text-neutral-700 dark:text-neutral-200">
              Chat settings
            </div>
            <div className="mt-2 flex items-center justify-between gap-4 text-xs text-neutral-600 dark:text-neutral-300">
              <span>Show reasoning</span>
              <ToggleSwitch checked={showReasoning} onChange={onToggleReasoning} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
