import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../hooks/use_media_query';

interface AssistantPanelProps {
  children: ReactNode;
  headingId: string;
  onClose: () => void;
}

function useAssistantPanelFocus(desktop: boolean) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  useEffect(
    () => () => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    },
    [],
  );
  useEffect(() => {
    const element = dialog.current;
    if (desktop || !element) return;
    element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, [desktop]);
  return dialog;
}

/** Uses a native modal focus boundary on narrow screens and an inline sidebar on wide screens. */
export function AssistantPanel({ children, headingId, onClose }: AssistantPanelProps) {
  const desktop = useMediaQuery('(min-width: 1536px)');
  const dialog = useAssistantPanelFocus(desktop);
  const escape = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };
  if (desktop)
    return (
      <aside
        aria-labelledby={headingId}
        className="flex h-full w-[480px] min-w-[480px] flex-col border-l border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
        id="shared-assistant-sidebar"
        onKeyDown={escape}
      >
        {children}
      </aside>
    );
  return createPortal(
    <dialog
      aria-labelledby={headingId}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none border-0 bg-neutral-50 p-0 text-neutral-900 backdrop:bg-neutral-950/40 sm:w-[480px] dark:bg-neutral-800 dark:text-neutral-100"
      id="shared-assistant-sidebar"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialog}
    >
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </dialog>,
    document.body,
  );
}
