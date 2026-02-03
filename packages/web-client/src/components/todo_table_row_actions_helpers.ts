import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useFloatingPosition } from '../hooks/use_floating_position';

/** Hook for popover dismiss behavior (click outside, escape key). */
export const usePopoverDismiss = (
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

type MenuHandler = () => void;

type CopyHandler = () => Promise<void>;

type SetCopied = Dispatch<SetStateAction<boolean>>;

interface MenuRefsOptions {
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  setFloating: (node: HTMLDivElement | null) => void;
  setReference: (node: HTMLButtonElement | null) => void;
}

interface MenuRefsState {
  setRefs: (node: HTMLDivElement | null) => void;
  setReference: (node: HTMLButtonElement | null) => void;
}

export interface RowActionsMenuState {
  copied: boolean;
  floatingStyles: React.CSSProperties;
  handleCopyId: () => void;
  handleOpenEdit: () => void;
  handleToggleTimeTracking: () => void;
  isOpen: boolean;
  menuButtonRef: React.RefObject<HTMLButtonElement | null>;
  setReference: (node: HTMLButtonElement | null) => void;
  setRefs: (node: HTMLDivElement | null) => void;
  toggleMenu: () => void;
}

export const createCopyHandler = (
  todoId: string,
  closeMenu: () => void,
  setCopied: SetCopied,
): CopyHandler => {
  return async () => {
    const success = await copyToClipboard(todoId);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
    closeMenu();
  };
};

export const createMenuHandler = (action: MenuHandler, closeMenu: () => void): MenuHandler => {
  return () => {
    action();
    closeMenu();
  };
};

export const useMenuRefs = ({
  menuRef,
  menuButtonRef,
  setFloating,
  setReference,
}: MenuRefsOptions): MenuRefsState => {
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      menuRef.current = node;
      setFloating(node);
    },
    [menuRef, setFloating],
  );

  const setReferenceRef = useCallback(
    (node: HTMLButtonElement | null) => {
      menuButtonRef.current = node;
      setReference(node);
    },
    [menuButtonRef, setReference],
  );

  return {
    setRefs,
    setReference: setReferenceRef,
  };
};

export const useRowActionsMenuState = (
  todoId: string,
  onToggleTimeTracking: () => void,
  onOpenEdit: () => void,
): RowActionsMenuState => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const { refs, floatingStyles } = useFloatingPosition({
    placement: 'bottom-end',
    open: isOpen,
  });

  const { setRefs, setReference } = useMenuRefs({
    menuRef,
    menuButtonRef,
    setFloating: refs.setFloating,
    setReference: refs.setReference,
  });

  const closeMenu = useCallback(() => setIsOpen(false), []);
  const toggleMenu = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleCopyId = useCallback(createCopyHandler(todoId, closeMenu, setCopied), [
    closeMenu,
    todoId,
  ]);
  const handleToggleTimeTracking = useCallback(createMenuHandler(onToggleTimeTracking, closeMenu), [
    closeMenu,
    onToggleTimeTracking,
  ]);
  const handleOpenEdit = useCallback(createMenuHandler(onOpenEdit, closeMenu), [
    closeMenu,
    onOpenEdit,
  ]);

  usePopoverDismiss(menuRef, closeMenu);

  return {
    copied,
    floatingStyles: floatingStyles as React.CSSProperties,
    handleCopyId,
    handleOpenEdit,
    handleToggleTimeTracking,
    isOpen,
    menuButtonRef,
    setReference,
    setRefs,
    toggleMenu,
  };
};
