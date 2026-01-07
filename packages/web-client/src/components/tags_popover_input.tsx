/**
 * Inline tag input component for use in popovers
 * Compact variant of TagInput without outer border
 */
import { type FC, useCallback, useEffect } from 'react';

import { DROPDOWN_CONTAINER, DROPDOWN_ITEM } from '../styles/interactive';
import {
  filterSuggestions,
  handleNavigationKey,
  useClickOutside,
  useTagInputState,
} from './tag_input_helpers';

interface InlineTagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  autoFocus?: boolean;
}

interface TagBadgeProps {
  tag: string;
  onRemove: () => void;
}

const TagBadge: FC<TagBadgeProps> = ({ tag, onRemove }) => (
  <span className="bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">
    {tag}
    <button
      className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200 ml-1"
      onClick={onRemove}
      type="button"
    >
      ×
    </button>
  </span>
);

interface SuggestionListProps {
  suggestions: string[];
  selectedIndex: number;
  onSelect: (suggestion: string) => void;
  suggestionsRef: React.RefObject<HTMLDivElement | null>;
}

const SuggestionList: FC<SuggestionListProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  suggestionsRef,
}) => (
  <div className={`top-full w-full p-1 ${DROPDOWN_CONTAINER}`} ref={suggestionsRef}>
    {suggestions.slice(0, 5).map((suggestion, index) => (
      <button
        className={`${DROPDOWN_ITEM} ${index === selectedIndex ? 'bg-primary-100 dark:bg-primary-900' : ''}`}
        key={suggestion}
        onClick={() => onSelect(suggestion)}
        type="button"
      >
        {suggestion}
      </button>
    ))}
  </div>
);

interface TagActionsParams {
  tags: string[];
  onChange: (tags: string[]) => void;
  state: ReturnType<typeof useTagInputState>;
}

const useTagActions = ({ tags, onChange, state }: TagActionsParams) => {
  const addTag = useCallback(
    (tag: string) => {
      const trimmedTag = tag.trim();
      if (trimmedTag && !tags.includes(trimmedTag)) onChange([...tags, trimmedTag]);
      state.reset();
    },
    [tags, onChange, state],
  );

  const removeTag = useCallback(
    (tagToRemove: string) => onChange(tags.filter((t) => t !== tagToRemove)),
    [tags, onChange],
  );

  return { addTag, removeTag };
};

interface KeyDownContext {
  showSuggestions: boolean;
  selectedIndex: number;
  suggestions: string[];
  inputValue: string;
}

const handleEnterKey = (ctx: KeyDownContext, addTag: (tag: string) => void): boolean => {
  if (ctx.showSuggestions && ctx.selectedIndex >= 0) {
    addTag(ctx.suggestions[ctx.selectedIndex]);
  } else if (ctx.inputValue.trim()) {
    addTag(ctx.inputValue);
  }
  return true;
};

const handleArrowKey = (
  key: 'ArrowDown' | 'ArrowUp',
  ctx: KeyDownContext,
  setIndex: (index: number) => void,
): boolean => {
  if (ctx.showSuggestions && ctx.suggestions.length > 0) {
    setIndex(handleNavigationKey(key, ctx.selectedIndex, ctx.suggestions.length));
  }
  return true;
};

interface KeyDownHandlerParams {
  state: ReturnType<typeof useTagInputState>;
  filteredSuggestions: string[];
  tags: string[];
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
}

const useKeyDownHandler = ({
  state,
  filteredSuggestions,
  tags,
  addTag,
  removeTag,
}: KeyDownHandlerParams) =>
  useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      let shouldPrevent = false;
      const ctx: KeyDownContext = {
        showSuggestions: state.showSuggestions,
        selectedIndex: state.selectedSuggestionIndex,
        suggestions: filteredSuggestions,
        inputValue: state.inputValue,
      };

      if (e.key === 'Enter') {
        shouldPrevent = handleEnterKey(ctx, addTag);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        shouldPrevent = handleArrowKey(e.key, ctx, state.setSelectedSuggestionIndex);
      } else if (e.key === 'Backspace' && state.inputValue === '' && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      } else if (e.key === 'Escape') {
        state.setShowSuggestions(false);
        state.setSelectedSuggestionIndex(-1);
      }

      if (shouldPrevent) e.preventDefault();
    },
    [addTag, removeTag, state, filteredSuggestions, tags],
  );

interface TagListProps {
  tags: string[];
  onRemove: (tag: string) => void;
}

const TagList: FC<TagListProps> = ({ tags, onRemove }) => (
  <>
    {tags.map((tag) => (
      <TagBadge key={tag} onRemove={() => onRemove(tag)} tag={tag} />
    ))}
  </>
);

interface TagInputFieldProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const TagInputField: FC<TagInputFieldProps> = ({
  inputRef,
  value,
  placeholder,
  onChange,
  onFocus,
  onKeyDown,
}) => (
  <input
    className="min-w-[80px] flex-1 border-none bg-transparent p-1 text-xs text-neutral-900 outline-none placeholder:text-neutral-500 dark:text-white dark:placeholder:text-neutral-400"
    onChange={(e) => onChange(e.target.value)}
    onFocus={onFocus}
    onKeyDown={onKeyDown}
    placeholder={placeholder}
    ref={inputRef}
    type="text"
    value={value}
  />
);

/** Hook for auto-focus on mount */
const useAutoFocus = (
  autoFocus: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>,
): void => {
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, inputRef]);
};

export const InlineTagInput: FC<InlineTagInputProps> = ({
  tags,
  onChange,
  suggestions = [],
  autoFocus = false,
}) => {
  const state = useTagInputState();
  const filteredSuggestions = filterSuggestions(suggestions, state.inputValue, tags);
  const { addTag, removeTag } = useTagActions({ tags, onChange, state });

  const updateSuggestionState = useCallback(
    (value: string) => {
      state.setInputValue(value);
      state.setShowSuggestions(value.length > 0 && filteredSuggestions.length > 0);
      state.setSelectedSuggestionIndex(-1);
    },
    [state, filteredSuggestions.length],
  );

  const handleKeyDown = useKeyDownHandler({ state, filteredSuggestions, tags, addTag, removeTag });
  const handleSuggestionSelect = (s: string) => {
    addTag(s);
    state.inputRef.current?.focus();
  };

  useClickOutside(state.inputRef, state.suggestionsRef, () => state.setShowSuggestions(false));
  useAutoFocus(autoFocus, state.inputRef);

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1">
        <TagList onRemove={removeTag} tags={tags} />
        <TagInputField
          inputRef={state.inputRef}
          onChange={updateSuggestionState}
          onFocus={() => updateSuggestionState(state.inputValue)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? 'Add tags...' : ''}
          value={state.inputValue}
        />
      </div>
      {state.showSuggestions && filteredSuggestions.length > 0 && (
        <SuggestionList
          onSelect={handleSuggestionSelect}
          selectedIndex={state.selectedSuggestionIndex}
          suggestions={filteredSuggestions}
          suggestionsRef={state.suggestionsRef}
        />
      )}
    </div>
  );
};
