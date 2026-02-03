/**
 * AddTodoPopover - Plus icon button that opens a popover with the add todo form
 */
import { type Todo } from '@eddo/core-client';
import { type FC, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTags } from '../hooks/use_tags';
import { TRANSITION_FAST } from '../styles/interactive';
import { AdvancedToggle, FormActions, FormFields } from './add_todo_popover_fields';
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
    {
      parentTodo,
    },
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
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <div className="mb-1 flex items-center justify-between text-sm font-medium text-neutral-700 dark:text-neutral-300">
          <span>Add Todo</span>
          <AdvancedToggle
            expanded={showAdvanced}
            onToggle={() => setShowAdvanced((prev) => !prev)}
          />
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
      {!hideTrigger && (
        <AddTodoTrigger
          className={triggerClassName}
          label={triggerLabel}
          onClick={openPopover}
          setReferenceRef={setReferenceRef}
          title={triggerTitle}
          variant={triggerVariant}
        />
      )}
      {isOpen && (
        <PopoverForm
          floatingStyles={floatingStyles}
          onClose={closePopover}
          onSuccess={closePopover}
          parentTodo={parentTodo}
          setFloatingRef={setFloatingRef}
        />
      )}
    </>
  );
};
