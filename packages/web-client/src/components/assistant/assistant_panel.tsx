import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface AssistantPanelProps {
  children: ReactNode;
  headingId: string;
  onClose: () => void;
}

/** Keeps the assistant beside editable todo content without a modal or focus trap. */
export function AssistantPanel({ children, headingId, onClose }: AssistantPanelProps) {
  const previousFocus = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  useEffect(
    () => () => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    },
    [],
  );
  const escape = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onClose();
  };
  return (
    <aside
      aria-labelledby={headingId}
      className="flex h-full w-[min(480px,45vw)] min-w-0 shrink-0 flex-col border-l border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
      id="shared-assistant-sidebar"
      onKeyDown={escape}
    >
      {children}
    </aside>
  );
}
