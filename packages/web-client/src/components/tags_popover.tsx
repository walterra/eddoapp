/**
 * TagsPopover component for inline tag editing in table view
 */
import type { Todo } from '@eddo/core-client';
import { useQueryClient } from '@tanstack/react-query';
import { type FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useTags } from '../hooks/use_tags';
import { useTodoMutation } from '../hooks/use_todo_mutations';
import { TRANSITION_FAST } from '../styles/interactive';
import { TagDisplay } from './tag_display';
import { InlineTagInput } from './tags_popover_input';

interface TagsPopoverProps {
  todo: Todo;
}

interface PopoverPosition {
  top: number;
  left: number;
}

const POPOVER_STYLES =
  'fixed z-50 min-w-64 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

interface TagsPopoverMenuProps {
  position: PopoverPosition;
  tags: string[];
  suggestions: string[];
  onClose: () => void;
  onSave: (tags: string[]) => void;
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
  position,
  tags,
  suggestions,
  onClose,
  onSave,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [localTags, setLocalTags] = useState(tags);

  usePopoverDismiss(menuRef, () => {
    onSave(localTags);
    onClose();
  });

  return createPortal(
    <div
      className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
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
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

const TagsTrigger: FC<TagsTriggerProps> = ({ tags, onClick, buttonRef }) => (
  <button
    className="hover:bg-primary-50 dark:hover:bg-primary-900/30 -mx-1 cursor-pointer rounded px-1 py-0.5"
    onClick={onClick}
    ref={buttonRef}
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
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const updateTodo = useTodoMutation();
  const queryClient = useQueryClient();
  const { allTags } = useTags();

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

    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }

    setIsOpen(!isOpen);
  };

  return (
    <>
      <TagsTrigger buttonRef={buttonRef} onClick={handleToggle} tags={todo.tags} />
      {isOpen && (
        <TagsPopoverMenu
          onClose={() => setIsOpen(false)}
          onSave={handleSave}
          position={position}
          suggestions={allTags}
          tags={todo.tags}
        />
      )}
    </>
  );
};
