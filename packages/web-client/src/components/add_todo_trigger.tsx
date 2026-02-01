import { type FC } from 'react';
import { HiPlus } from 'react-icons/hi';

export type AddTodoTriggerVariant = 'button' | 'icon';

interface AddTodoTriggerProps {
  onClick: () => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
  className?: string;
  label?: string;
  title?: string;
  variant: AddTodoTriggerVariant;
}

export const AddTodoTrigger: FC<AddTodoTriggerProps> = ({
  onClick,
  setReferenceRef,
  className,
  label,
  title,
  variant,
}) => {
  const baseClassName =
    className ??
    'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 flex h-8 items-center gap-1.5 rounded-lg px-2 text-white md:px-3';
  const titleText = title ?? 'Add todo (n)';
  const labelText = label ?? 'Add todo';

  if (variant === 'icon') {
    return (
      <button
        aria-label={titleText}
        className={baseClassName}
        onClick={onClick}
        ref={setReferenceRef}
        title={titleText}
        type="button"
      >
        <HiPlus className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      aria-label={labelText}
      className={baseClassName}
      onClick={onClick}
      ref={setReferenceRef}
      title={titleText}
      type="button"
    >
      <HiPlus className="h-4 w-4" />
      <span className="hidden text-sm font-medium md:inline">{labelText}</span>
    </button>
  );
};
