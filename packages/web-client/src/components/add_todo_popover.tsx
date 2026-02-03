/**
 * AddTodoPopover - Plus icon button that opens a popover with the add todo form
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { type FC, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTags } from '../hooks/use_tags';
import { TRANSITION_FAST } from '../styles/interactive';
import {
  type AddTodoFormState,
  AdvancedToggle,
  FormActions,
  FormFields,
} from './add_todo_popover_fields';
import { useAddTodoForm, usePopoverDismiss } from './add_todo_popover_form';
import { useAddTodoPopoverState } from './add_todo_popover_state';
import { AddTodoTrigger, type AddTodoTriggerVariant } from './add_todo_trigger';
import { DatabaseErrorMessage } from './database_error_message';

const POPOVER_STYLES =
  'z-50 w-80 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';
interface PopoverFormProps {
  floatingStyles: object;
  setFloatingRef: (node: HTMLDivElement | null) => void;
  onClose: () => void;
  onSuccess: () => void;
  parentTodo?: Todo;
}

interface PopoverFormContentProps {
  allTags: string[];
  error: DatabaseError | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  parentTodo?: Todo;
  setShowAdvanced: (value: boolean) => void;
  setState: React.Dispatch<React.SetStateAction<AddTodoFormState>>;
  showAdvanced: boolean;
  state: AddTodoFormState;
  clearError: () => void;
}

const PopoverFormContent: FC<PopoverFormContentProps> = ({
  allTags,
  clearError,
  error,
  isPending,
  onClose,
  onSubmit,
  parentTodo,
  setShowAdvanced,
  setState,
  showAdvanced,
  state,
}) => (
  <form className="flex flex-col gap-2" onSubmit={onSubmit}>
    <div className="mb-1 flex items-center justify-between text-sm font-medium text-neutral-700 dark:text-neutral-300">
      <span>Add Todo</span>
      <AdvancedToggle expanded={showAdvanced} onToggle={() => setShowAdvanced(!showAdvanced)} />
    </div>
    {error && <DatabaseErrorMessage error={error} onDismiss={clearError} />}
    <FormFields
      allTags={allTags}
      parentTodo={parentTodo}
      setState={setState}
      showAdvanced={showAdvanced}
      state={state}
    />
    <FormActions
      isDisabled={isPending || state.title === ''}
      isPending={isPending}
      onClose={onClose}
    />
  </form>
);

const PopoverForm: FC<PopoverFormProps> = ({
  floatingStyles,
  setFloatingRef,
  onClose,
  onSuccess,
  parentTodo,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { allTags } = useTags();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { state, setState, error, isPending, handleSubmit, clearError } = useAddTodoForm(
    onSuccess,
    { parentTodo },
  );

  const setRefs = (node: HTMLDivElement | null) => {
    menuRef.current = node;
    setFloatingRef(node);
  };

  usePopoverDismiss(menuRef, onClose);

  return createPortal(
    <div
      className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
      ref={setRefs}
      style={floatingStyles as React.CSSProperties}
    >
      <PopoverFormContent
        allTags={allTags}
        clearError={clearError}
        error={error}
        isPending={isPending}
        onClose={onClose}
        onSubmit={handleSubmit}
        parentTodo={parentTodo}
        setShowAdvanced={setShowAdvanced}
        setState={setState}
        showAdvanced={showAdvanced}
        state={state}
      />
    </div>,
    document.body,
  );
};

export interface AddTodoPopoverProps {
  /** Whether to enable keyboard shortcut (default: true). Set to false for duplicate instances. */
  enableKeyboardShortcut?: boolean;
  parentTodo?: Todo;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerTitle?: string;
  triggerVariant?: AddTodoTriggerVariant;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  referenceElement?: HTMLElement | null;
  hideTrigger?: boolean;
}

interface TriggerSectionProps {
  className?: string;
  hideTrigger: boolean;
  label?: string;
  onClick: () => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
  title?: string;
  variant: AddTodoTriggerVariant;
}

const TriggerSection: FC<TriggerSectionProps> = ({
  className,
  hideTrigger,
  label,
  onClick,
  setReferenceRef,
  title,
  variant,
}) => {
  if (hideTrigger) return null;
  return (
    <AddTodoTrigger
      className={className}
      label={label}
      onClick={onClick}
      setReferenceRef={setReferenceRef}
      title={title}
      variant={variant}
    />
  );
};

interface PopoverSectionProps {
  floatingStyles: object;
  isOpen: boolean;
  onClose: () => void;
  parentTodo?: Todo;
  setFloatingRef: (node: HTMLDivElement | null) => void;
}

const PopoverSection: FC<PopoverSectionProps> = ({
  floatingStyles,
  isOpen,
  onClose,
  parentTodo,
  setFloatingRef,
}) => {
  if (!isOpen) return null;
  return (
    <PopoverForm
      floatingStyles={floatingStyles}
      onClose={onClose}
      onSuccess={onClose}
      parentTodo={parentTodo}
      setFloatingRef={setFloatingRef}
    />
  );
};

export const AddTodoPopover: FC<AddTodoPopoverProps> = ({
  enableKeyboardShortcut = true,
  parentTodo,
  triggerClassName,
  triggerLabel,
  triggerTitle,
  triggerVariant = 'button',
  open,
  onOpenChange,
  referenceElement,
  hideTrigger = false,
}) => {
  const { floatingStyles, isOpen, openPopover, closePopover, setFloatingRef, setReferenceRef } =
    useAddTodoPopoverState({
      enableKeyboardShortcut,
      onOpenChange,
      open,
      referenceElement,
    });

  return (
    <>
      <TriggerSection
        className={triggerClassName}
        hideTrigger={hideTrigger}
        label={triggerLabel}
        onClick={openPopover}
        setReferenceRef={setReferenceRef}
        title={triggerTitle}
        variant={triggerVariant}
      />
      <PopoverSection
        floatingStyles={floatingStyles}
        isOpen={isOpen}
        onClose={closePopover}
        parentTodo={parentTodo}
        setFloatingRef={setFloatingRef}
      />
    </>
  );
};
