import { type FC } from 'react';
import { HiPlus } from 'react-icons/hi';

export type AddTodoTriggerVariant = 'button' | 'icon' | 'text';

interface AddTodoTriggerProps {
  onClick: () => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
  className?: string;
  label?: string;
  title?: string;
  variant: AddTodoTriggerVariant;
}

interface TriggerButtonProps {
  onClick: () => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
  className: string;
  labelText: string;
  titleText: string;
}

const getBaseClassName = (className?: string): string =>
  className ??
  'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 flex h-8 items-center gap-1.5 rounded-lg px-2 text-white md:px-3';

const IconTriggerButton: FC<TriggerButtonProps> = ({
  onClick,
  setReferenceRef,
  className,
  titleText,
}) => (
  <button
    aria-label={titleText}
    className={className}
    onClick={onClick}
    ref={setReferenceRef}
    title={titleText}
    type="button"
  >
    <HiPlus className="h-4 w-4" />
  </button>
);

const TextTriggerButton: FC<TriggerButtonProps> = ({
  onClick,
  setReferenceRef,
  className,
  labelText,
  titleText,
}) => (
  <button
    aria-label={labelText}
    className={className}
    onClick={onClick}
    ref={setReferenceRef}
    title={titleText}
    type="button"
  >
    {labelText}
  </button>
);

const DefaultTriggerButton: FC<TriggerButtonProps> = ({
  onClick,
  setReferenceRef,
  className,
  labelText,
  titleText,
}) => (
  <button
    aria-label={labelText}
    className={className}
    onClick={onClick}
    ref={setReferenceRef}
    title={titleText}
    type="button"
  >
    <HiPlus className="h-4 w-4" />
    <span className="hidden text-sm font-medium md:inline">{labelText}</span>
  </button>
);

export const AddTodoTrigger: FC<AddTodoTriggerProps> = ({
  onClick,
  setReferenceRef,
  className,
  label,
  title,
  variant,
}) => {
  const baseClassName = getBaseClassName(className);
  const titleText = title ?? 'Add todo (n)';
  const labelText = label ?? 'Add todo';
  const buttonProps: TriggerButtonProps = {
    className: baseClassName,
    labelText,
    onClick,
    setReferenceRef,
    titleText,
  };

  if (variant === 'icon') {
    return <IconTriggerButton {...buttonProps} />;
  }

  if (variant === 'text') {
    return <TextTriggerButton {...buttonProps} />;
  }

  return <DefaultTriggerButton {...buttonProps} />;
};
