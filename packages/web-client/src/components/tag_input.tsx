import { type FC, useCallback } from 'react';

import { DROPDOWN_CONTAINER, DROPDOWN_ITEM } from '../styles/interactive';
import {
  filterSuggestions,
  handleNavigationKey,
  useClickOutside,
  useTagInputState,
} from './tag_input_helpers';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  size?: 'sm' | 'md';
}

interface TagBadgeProps {
  tag: string;
  onRemove: () => void;
}

const TagBadge: FC<TagBadgeProps> = ({ tag, onRemove }) => (
  <span className="bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
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

interface EnterKeyContext {
  showSuggestions: boolean;
  selectedIndex: number;
  suggestions: string[];
  inputValue: string;
}

const handleEnterKey = (ctx: EnterKeyContext, addTag: (tag: string) => void): boolean => {
  if (ctx.showSuggestions && ctx.selectedIndex >= 0) {
    addTag(ctx.suggestions[ctx.selectedIndex]);
  } else if (ctx.inputValue.trim()) {
    addTag(ctx.inputValue);
  }
  return true;
};

interface ArrowKeyContext {
  key: 'ArrowDown' | 'ArrowUp';
  showSuggestions: boolean;
  selectedIndex: number;
  suggestionsLength: number;
}

const handleArrowKey = (ctx: ArrowKeyContext, setIndex: (index: number) => void): boolean => {
  if (ctx.showSuggestions && ctx.suggestionsLength > 0) {
    setIndex(handleNavigationKey(ctx.key, ctx.selectedIndex, ctx.suggestionsLength));
  }
  return true;
};

interface TagListDisplayProps {
  tags: string[];
  removeTag: (tag: string) => void;
}

const TagListDisplay: FC<TagListDisplayProps> = ({ tags, removeTag }) => (
  <>
    {tags.map((tag) => (
      <TagBadge key={tag} onRemove={() => removeTag(tag)} tag={tag} />
    ))}
  </>
);

interface TagInputContainerProps {
  children: React.ReactNode;
  size: 'sm' | 'md';
}

const TagInputContainer: FC<TagInputContainerProps> = ({ children, size }) => {
  const paddingClass = size === 'sm' ? 'p-2' : 'p-2.5';

  return (
    <div
      className={`focus-within:border-primary-500 focus-within:ring-primary-500 flex flex-wrap items-center gap-1 rounded-lg border border-neutral-300 bg-neutral-50 ${paddingClass} focus-within:ring-1 dark:border-neutral-600 dark:bg-neutral-700`}
    >
      {children}
    </div>
  );
};

interface InputFieldProps {
  value: string;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const InputField: FC<InputFieldProps> = (props) => (
  <input
    className="min-w-[100px] flex-1 border-none bg-transparent p-0 text-sm text-neutral-900 outline-none placeholder:text-neutral-500 dark:text-white dark:placeholder:text-neutral-400"
    onChange={props.onChange}
    onFocus={props.onFocus}
    onKeyDown={props.onKeyDown}
    placeholder={props.placeholder}
    ref={props.inputRef}
    type="text"
    value={props.value}
  />
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
      const ctx = {
        showSuggestions: state.showSuggestions,
        selectedIndex: state.selectedSuggestionIndex,
        suggestions: filteredSuggestions,
        inputValue: state.inputValue,
      };
      if (e.key === 'Enter') {
        shouldPrevent = handleEnterKey(ctx, addTag);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        shouldPrevent = handleArrowKey(
          { ...ctx, key: e.key, suggestionsLength: filteredSuggestions.length },
          state.setSelectedSuggestionIndex,
        );
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

const useUpdateSuggestionState = (
  state: ReturnType<typeof useTagInputState>,
  filteredSuggestionsLength: number,
) =>
  useCallback(
    (value: string) => {
      state.setInputValue(value);
      state.setShowSuggestions(value.length > 0 && filteredSuggestionsLength > 0);
      state.setSelectedSuggestionIndex(-1);
    },
    [state, filteredSuggestionsLength],
  );

export const TagInput: FC<TagInputProps> = ({
  tags,
  onChange,
  placeholder = 'Add tags...',
  suggestions = [],
  size = 'md',
}) => {
  const state = useTagInputState();
  const filteredSuggestions = filterSuggestions(suggestions, state.inputValue, tags);
  const { addTag, removeTag } = useTagActions({ tags, onChange, state });
  const updateSuggestionState = useUpdateSuggestionState(state, filteredSuggestions.length);
  const handleKeyDown = useKeyDownHandler({
    state,
    filteredSuggestions,
    tags,
    addTag,
    removeTag,
  });

  useClickOutside(state.inputRef, state.suggestionsRef, () => state.setShowSuggestions(false));

  return (
    <div className="relative">
      <TagInputContainer size={size}>
        <TagListDisplay removeTag={removeTag} tags={tags} />
        <InputField
          inputRef={state.inputRef}
          onChange={(e) => updateSuggestionState(e.target.value)}
          onFocus={() => updateSuggestionState(state.inputValue)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          value={state.inputValue}
        />
      </TagInputContainer>
      {state.showSuggestions && filteredSuggestions.length > 0 && (
        <SuggestionList
          onSelect={(s) => {
            addTag(s);
            state.inputRef.current?.focus();
          }}
          selectedIndex={state.selectedSuggestionIndex}
          suggestions={filteredSuggestions}
          suggestionsRef={state.suggestionsRef}
        />
      )}
    </div>
  );
};
