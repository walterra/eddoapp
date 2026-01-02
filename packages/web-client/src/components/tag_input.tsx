import { type FC, useCallback } from 'react';

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
}

export const TagInput: FC<TagInputProps> = ({
  tags,
  onChange,
  placeholder = 'Add tags...',
  suggestions = [],
}) => {
  const {
    inputValue,
    setInputValue,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    inputRef,
    suggestionsRef,
    reset,
  } = useTagInputState();

  const filteredSuggestions = filterSuggestions(suggestions, inputValue, tags);

  const addTag = useCallback(
    (tag: string) => {
      const trimmedTag = tag.trim();
      if (trimmedTag && !tags.includes(trimmedTag)) {
        onChange([...tags, trimmedTag]);
      }
      reset();
    },
    [tags, onChange, reset],
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      onChange(tags.filter((tag) => tag !== tagToRemove));
    },
    [tags, onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(value.length > 0 && filteredSuggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && selectedSuggestionIndex >= 0) {
        addTag(filteredSuggestions[selectedSuggestionIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions && filteredSuggestions.length > 0) {
        setSelectedSuggestionIndex(
          handleNavigationKey(e.key, selectedSuggestionIndex, filteredSuggestions.length),
        );
      }
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion);
    inputRef.current?.focus();
  };

  useClickOutside(inputRef, suggestionsRef, () => setShowSuggestions(false));

  return (
    <div className="relative">
      <div className="focus-within:ring-opacity-50 flex flex-wrap items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 dark:border-gray-600 dark:bg-gray-700">
        {tags.map((tag) => (
          <span
            className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300"
            key={tag}
          >
            {tag}
            <button
              className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              onClick={() => removeTag(tag)}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="min-w-[100px] flex-1 border-none bg-transparent p-0 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          onChange={handleInputChange}
          onFocus={() => {
            setShowSuggestions(inputValue.length > 0 && filteredSuggestions.length > 0);
            setSelectedSuggestionIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          ref={inputRef}
          type="text"
          value={inputValue}
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          className="absolute top-full z-10 mt-1 max-h-96 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700"
          ref={suggestionsRef}
        >
          {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
            <button
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                index === selectedSuggestionIndex ? 'bg-blue-100 dark:bg-blue-900' : ''
              }`}
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
