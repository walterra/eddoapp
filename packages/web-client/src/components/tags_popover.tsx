/**
 * TagsPopover component for inline tag editing in table view
 */
import type { Todo } from '@eddo/core-client';
import { useQueryClient } from '@tanstack/react-query';
import { type FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useFloatingPosition } from '../hooks/use_floating_position';
import { useTags } from '../hooks/use_tags';
import { useTodoMutation } from '../hooks/use_todo_mutations';
import { TRANSITION_FAST } from '../styles/interactive';
import { TagDisplay } from './tag_display';
import { InlineTagInput } from './tags_popover_input';

interface TagsPopoverProps {
  todo: Todo;
}

const POPOVER_STYLES =
  'z-50 min-w-64 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

interface TagsPopoverMenuProps {
  tags: string[];
  suggestions: string[];
  onClose: () => void;
  onSave: (tags: string[]) => void;
  floatingStyles: object;
  setFloatingRef: (node: HTMLDivElement | null) => void;
}

/**
 * Hook for popover dismiss behavior (click outside, escape key)
 */
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

const TagsPopoverMenu: FC<TagsPopoverMenuProps> = ({
  tags,
  suggestions,
  onClose,
  onSave,
  floatingStyles,
  setFloatingRef,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [localTags, setLocalTags] = useState(tags);

  const setRefs = (node: HTMLDivElement | null) => {
    menuRef.current = node;
    setFloatingRef(node);
  };

  usePopoverDismiss(menuRef, () => {
    onSave(localTags);
    onClose();
  });

  return createPortal(
    <div
      className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
      ref={setRefs}
      style={floatingStyles as React.CSSProperties}
    >
      <InlineTagInput
        autoFocus
        onChange={setLocalTags}
        suggestions={suggestions}
        tags={localTags}
      />
    </div>,
    document.body,
  );
};

/**
 * Trigger button that displays current tags
 */
interface TagsTriggerProps {
  tags: string[];
  onClick: (e: React.MouseEvent) => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
}

const TagsTrigger: FC<TagsTriggerProps> = ({ tags, onClick, setReferenceRef }) => (
  <button
    className="hover:bg-primary-50 dark:hover:bg-primary-900/30 -mx-1 cursor-pointer rounded px-1 py-0.5"
    onClick={onClick}
    ref={setReferenceRef}
    title="Edit tags"
    type="button"
  >
    {tags.length > 0 ? (
      <TagDisplay maxTags={3} size="xs" tags={tags} />
    ) : (
      <span className="text-xs text-neutral-400">Add tags...</span>
    )}
  </button>
);

export const TagsPopover: FC<TagsPopoverProps> = ({ todo }) => {
  const [isOpen, setIsOpen] = useState(false);
  const updateTodo = useTodoMutation();
  const queryClient = useQueryClient();
  const { allTags } = useTags();
  const { refs, floatingStyles } = useFloatingPosition({
    placement: 'bottom-start',
    open: isOpen,
  });

  const handleSave = async (newTags: string[]) => {
    const tagsChanged =
      newTags.length !== todo.tags.length || newTags.some((tag, i) => tag !== todo.tags[i]);

    if (tagsChanged) {
      await updateTodo.mutateAsync({ ...todo, tags: newTags });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <>
      <TagsTrigger onClick={handleToggle} setReferenceRef={refs.setReference} tags={todo.tags} />
      {isOpen && (
        <TagsPopoverMenu
          floatingStyles={floatingStyles}
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
          setFloatingRef={refs.setFloating}
          suggestions={allTags}
          tags={todo.tags}
        />
      )}
    </>
  );
};
