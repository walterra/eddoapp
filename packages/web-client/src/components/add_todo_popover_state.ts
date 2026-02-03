import { useCallback, useEffect, useRef, useState } from 'react';

import { useFloatingPosition } from '../hooks/use_floating_position';

interface PopoverStateOptions {
  enableKeyboardShortcut: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  referenceElement?: HTMLElement | null;
}

interface PopoverState {
  floatingStyles: object;
  isOpen: boolean;
  openPopover: () => void;
  closePopover: () => void;
  setFloatingRef: (node: HTMLDivElement | null) => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
}

interface OpenHandlerOptions {
  isControlled: boolean;
  onOpenChange?: (open: boolean) => void;
  setIsOpenInternal: (open: boolean) => void;
}

interface CloseHandlerOptions {
  isControlled: boolean;
  onOpenChange?: (open: boolean) => void;
  setIsOpenInternal: (open: boolean) => void;
}

/** Hook for keyboard shortcut to open popover. */
const useKeyboardShortcut = (key: string, onTrigger: () => void, enabled: boolean = true): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isTyping) return;

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        onTrigger();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key, onTrigger, enabled]);
};

const createOpenHandler = ({
  isControlled,
  onOpenChange,
  setIsOpenInternal,
}: OpenHandlerOptions): (() => void) => {
  return () => {
    if (isControlled) {
      onOpenChange?.(true);
      return;
    }
    setIsOpenInternal(true);
  };
};

const createCloseHandler = ({
  isControlled,
  onOpenChange,
  setIsOpenInternal,
}: CloseHandlerOptions): (() => void) => {
  return () => {
    if (isControlled) {
      onOpenChange?.(false);
      return;
    }
    setIsOpenInternal(false);
  };
};

const useReferenceSync = (
  referenceElement: HTMLElement | null | undefined,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
  setReference: (node: HTMLElement | null) => void,
): void => {
  useEffect(() => {
    if (referenceElement) {
      setReference(referenceElement);
      return;
    }
    if (triggerRef.current) {
      setReference(triggerRef.current);
    }
  }, [referenceElement, setReference, triggerRef]);
};

export const useAddTodoPopoverState = (options: PopoverStateOptions): PopoverState => {
  const { enableKeyboardShortcut, open, onOpenChange, referenceElement } = options;
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isControlled = open !== undefined;
  const isOpen = open ?? isOpenInternal;
  const { refs, floatingStyles } = useFloatingPosition({ placement: 'bottom-start', open: isOpen });
  const openPopover = useCallback(
    createOpenHandler({
      isControlled,
      onOpenChange,
      setIsOpenInternal,
    }),
    [isControlled, onOpenChange],
  );
  const closePopover = useCallback(
    createCloseHandler({ isControlled, onOpenChange, setIsOpenInternal }),
    [isControlled, onOpenChange],
  );

  useReferenceSync(referenceElement, triggerRef, refs.setReference);
  useKeyboardShortcut('n', openPopover, enableKeyboardShortcut);

  const setReferenceRef = useCallback(
    (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (!referenceElement) {
        refs.setReference(node);
      }
    },
    [referenceElement, refs],
  );

  return {
    floatingStyles,
    isOpen,
    openPopover,
    closePopover,
    setFloatingRef: refs.setFloating,
    setReferenceRef,
  };
};
